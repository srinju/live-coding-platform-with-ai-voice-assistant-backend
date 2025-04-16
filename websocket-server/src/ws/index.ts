import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createClient } from "redis";

const app = express();
app.use(cors());
const httpServer = app.listen(3000);

const wss = new WebSocketServer({
    server : httpServer
});

interface requestBodType {
    questionId : string;
    question : string;
    interviewId : string;
    code : string;
    language : string;
    status : string;
};

const PRIMARY_BACKEND_URL = "http://localhost:3001";

//redis clent
const redisClient = createClient();

//subscribtion with the redis pub sub channel
(async () => {

    try {
        await redisClient.connect();
        console.log("connected to the redis pub sub channel successfully!!");

        await redisClient.subscribe('execution-results' , (message) => {
            //parse
            console.log("the message from the pub sub channel is : " , JSON.parse(message));

            const parsedMessage = JSON.parse(message);

            /*
            const {  resultStatus , resultOutput , resultTime , resultMemory} = parsedMessage;

            const dataToSendPayload = {
                resultStatus ,
                resultOutput ,
                resultTime ,
                resultMemory
            }
            */

            const {questionId , question , result , output , time , memory} = parsedMessage;

            //send the result to the frontend via the ws connection.
            wss.clients.forEach(client => {
                if(client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        questionId ,
                        question ,
                        result ,
                        output ,
                        time ,
                        memory
                    }))
                } else {
                    console.log("no active web socket connection found  , the clienis not ready to receive the result!!");
                }
            })
        });
        console.log("subscribed to the redis pub sub channel execution-results successfully!!");
    } catch(err) {
        console.error("an error occured while subscribing to the redis pub sub channel or sending request back to the frontend via the ws connection : " , err);
    }

})();

wss.on('connection' , async function connection(socket) {
    console.log("web socket connection established");

    //now the place where message means the code that the user will write 
    //each time the user will write code we will get the code here and hit our primary backend route to save the code in the db
    socket.on('message' , async function message(data) {
        //data is the 
        /*
            {
                "questionId" : "123" ,
                "code" : "print('hello world')" ,
                "language" : "python"
            }
        */
       console.log("the data received from the frontend is  : " , data.toString());
       try {
            //take room name maybe for rpc call to the voice agent 
            const {questionId , question , interviewId , status , code , language} = JSON.parse(data.toString());
            //ask vijay whether we need to create a room for each user or we just handle things from the db
            //hit out backend route to save the code in the db>
            if(!questionId || !interviewId) {
                console.error("questionId or interviewId is missing in the request body");
                return;
            }

            const requestBody : requestBodType = {
                questionId : questionId ,
                question : question,
                interviewId : interviewId,
                code : code,
                language : language,
                status : status || "unchecked"
            }

            const response = await fetch(`${PRIMARY_BACKEND_URL}/save-code` , {
                method : 'POST',
                headers : {
                    'content-type' : 'application/json'
                },
                body : JSON.stringify(requestBody)
            });

            if(!response.ok) {
                console.error("there was an error wile sending the code payload to the primary backend frm the ws server : " , response);
                return;
            }

            const responseData = await response.json();
            console.log("the response from the primary backend is : " , responseData);
            console.log("the payload was succesfully sent to the PM ");

        } catch(err) {
            console.error("an error occured while getthing the payload from the frontend : " , err);
        }
           
    });

    socket.on('close' , () => {
        console.log("web socket connection closed");
    });

    socket.on('error' , (err) => {
        console.error("an eerror occured in the web socket server : " , err);
    });
})

