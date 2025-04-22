//server where all the code written from the frontend comes here and the we save the code in db first without executing and 
//then push it to a redis queue
//worker picks it up and then executes it and then saves it amd then retrun the comilation results to the frontend

//web socker server takes the code persistently from the frotnend and hits our route to save the code in the db
//so the voice agent can fetch the code from the db and the see what the user has written so far.
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { createClient as cl } from "redis";
import * as dotenv from "dotenv";
import * as path from "path";
const app = express();

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = 3001;
app.use(express.json());
app.use(cors());

//init redis client
const redisClient = cl({
  url: 'redis://redis:6379'
});

function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if(!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error("supabase url or service role key is not set");
    }

    return createClient(supabaseUrl , supabaseServiceRoleKey);
}

//TODO : singleton pattern for redis connection
(async () => {
    try{
        await redisClient.connect();
        console.log("successfully connected to the redis server");
    } catch(err) {
        console.error("an error occured while connecting to the redis server : " , err);
    }
})();

//route to save the recently written code to db so the voice agent can fetch and then verify what the user is writiting 
app.post("/save-code" , async (req,res) => {
    //get the question id  , question  , the code of the user and the language 
    //save the payload in the db or maybe make a livekit room attribure call to send the payload to the agent when ever something chages , test it lateer
    //push the payload to the redis queue

    //data from the ws server>
    /*
            {
                "questionId" : "123" ,
                "code" : "print('hello world')" ,
                "language" : "python"
            }
    */
   const supabase = getSupabaseClient(); //create the supabase client 
    try {
        const body = req.body ; 
        const { questionId , question ,  interviewId ,  code , language , status} = body;

        console.log("the data receiveed from the ws server is : " , body);

        if(!questionId || !interviewId) {
            console.error("questionId or interviewId is missing in the request body");
            res.status(400).json({
                success : false,
                message : "questionId or interviewId is missing in the request body"
            });
            return;
        }

        //save the payload to our supabase db in the interview table> (CONFIRMed FROM VIJAY)
        const {data , error} = await supabase
            .from('live_coding_questions') //sep table
            .update({
                question_id : questionId,
                question : question,
                code : code,
                language : language,
                status : status
            })
            .eq('question_id' , questionId);

        if(error) {
            console.error("error updating interview table with the payload from the ws server " , error.message);
            res.status(400).json({
                success : false,
                message : error.message
            });
            return;
        }

        //else success
        console.log("successfully updated the payload from the ws server to the db" , data);
        res.status(200).json({
            success : true,
            message : "successfully updated the recent code chage to the db",
            data
        })
        return;

    } catch(err) {
        console.error("an error occured while saving the code payload from the ws server to the db : " , err);
        res.status(500).json({
            success : false ,
            message : "an error occured while saving the code payload from the ws server to the db"
        });
        return;
    }

});

//route to push the final code whjen the user is done coding this will basically have the entire
//final code to run the code.
//we push the payload to the redis queue and the worker picks it up and calls judge0 for the checking 

app.post('/run-code' , async (req ,res) => {
    //instance of the single ton redis client
    const supabase = getSupabaseClient();
    try{
        // body
        const body = req.body;
        const {questionId , question , interviewId , code , language , status} = body;

        //first push the code to the db before pushing it to the worker for excecution
        //questions will be created by the role-context supabase edge function while creating the role only in
        //the live_coding_questions table for that interviewId so we will have the interviewId
        const {data , error} = await supabase
            .from('live_coding_questions')
            .update({
                question_id : questionId,
                question : question,
                code : code,
                language : language,
                status : status
            })
            .eq('question_id' , questionId);

        if(error) {
            console.error("error updating interview table with the payload from the ws server " , error.message);
            res.status(400).json({
                success : false,
                message : error.message
            });
            return;
        }

        //else success
        console.log("final code of the user is safely updated in the db " ,data);

        //now push the payload to the redis queue
        const payload = {
            questionId : questionId,
            question : question,
            interviewId : interviewId,
            code : code,
            language : language,
            status : status
        };

        console.log("the payload to be pushed to the redis queue is : " , payload);

        //push the payload to a redis queue>
        await redisClient.lPush("submissions" , JSON.stringify(payload));

        //after this worker will pick it up and then execute it using judge0 and save it to db and send the response backe to the client 

        console.log("successfulyy pushed the payload to the redis queue");
        res.status(200).json({
            success : true,
            message : "successfully pushed the payload to the redis queue"
        })
        return;

    }catch(error) {
        console.error("there was an eror processing the execution of the code : " , error);
        res.status(500).json({
            message : "Internal Server Error"
        });
        return;
    }
});

app.post("/get-code-and-question" , async(req , res) => {
    const supabase = getSupabaseClient();

    try {
        const body = req.body;
        const {interviewId } = body;
        //fetcj the code and the question from the db using the interview id from the live_coding_questions table>
        const {data , error} = await supabase
            .from('live_coding_questions')
            .select('question , code , question_id , language')
            .eq('interview_id' , interviewId);

        if(error) {
            console.error("an error occured whihle fetching the code and the question from the supabase db using the query : " , error);
            res.status(400).json({
                success : false,
                message : "an error occured whihle fetching the code and the question from the supabase db using the query : " + error
            });
            return;
        };

        if (!data || data.length === 0) {
            console.error("No data found for this interview ID");
            res.status(404).json({
                success: false,
                message: "No data found for this interview ID"
            });
            return;
        }

        console.log("the data from the supabase db is : " , data);

        // Take the first row if multiple rows are returned
        const {question , code , question_id , language} = data[0];
        console.log("questionId -------------" , question_id);
        //send the question and the code to the frontend>
        res.status(200).json({
            success : true,
            message : "the code and the question fetched successfully!!",
            question ,
            questionId : question_id,
            code ,
            language : language
        });

    } catch(error) {
        console.error("an error occured while fetching the code and the questions from the db : " , error);
        res.status(500).json({
            success : false,
            message : "an error occured while fetching the code and the questions from the db"
        });
    }
});

app.listen(PORT , () => {
    console.log(`server Primary Backend is running on port ${PORT}`);
})


