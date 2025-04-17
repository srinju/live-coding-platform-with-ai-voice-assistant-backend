import { createClient as cl } from 'redis';
import { OpenAI } from 'openai';
import { createClient } from "@supabase/supabase-js";
import languageSupport from './languageSupport.json';
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';

function getLanguageId(languageName : string) {
    const match = languageSupport.find(lang => lang.name === languageName);
    return match ? match.id : null;
}

function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if(!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error("supabase url or service role key is not set");
    }

    return createClient(supabaseUrl , supabaseServiceRoleKey);
}

const openai  = new OpenAI({
    apiKey : process.env.OPENAI_API_KEY
});

interface CodeSubmission {
  questionId: string;
  question: string;
  interviewId: string;
  code: string;
  language: string;
}

class CodeExecutionWorker {
  private redisClient: ReturnType<typeof cl>;
  private isProcessing: boolean = false;
  private shouldExit: boolean = false;
  private queueName: string = 'submissions';
  private resultChannel: string = 'execution-results';
  
  constructor() {
    /*
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    */

    this.redisClient = cl();
    
    this.redisClient.on('error', (err: Error) => {
      console.error('Redis client error:', err);
      process.exit(1);
    });
  }
  
  async connect(): Promise<void> {
    await this.redisClient.connect();
    console.log('Connected to Redis');
  }
  
  async disconnect(): Promise<void> {
    this.shouldExit = true;
    if (!this.isProcessing) {
      await this.redisClient.disconnect();
      console.log('Disconnected from Redis');
    }
  }
  
  async start(): Promise<void> {
    console.log('Worker started, waiting for code submissions...');
    this.setupGracefulShutdown();
    
    while (!this.shouldExit) {
      try {
        this.isProcessing = false;
        const response = await this.redisClient.brPop(this.queueName, 5); // Timeout after 5 seconds
        console.log("the response from the redis queue is : " , response);

        if(!response) {
          console.log("No message in queue, waitingggg...");
          continue;
        }

        this.isProcessing = true;
        const submission = JSON.parse(response.element) as CodeSubmission;
        console.log(`Processing submission of the code question with id : ${submission.questionId}`);

        const languageId = getLanguageId(submission.language);
        if(!languageId) {
            console.log("invalid language for the requested code");
            return;
        }

        const code = submission.code;
        const question = submission.question;

        /*
        const prompt = `
            You are code analyser and you analyze the code and the question and then you give the
            expected input and output for the code.
            return only the input and output in the json format for sending to the judge0 api.
            for example : 
                "stdin": "5\n10\n"
                "expected_output": "15\n"
        `

        const gptResponse = await openai.chat.completions.create({
            model : "gpt-4o-mini",
            messages :[{
                role : "system",
                content : prompt
            },{
                role : "user",
                content : `the code is : ${code} and the question is : ${question}`
            }],
            response_format : {type : "json_object"}
        });

        const expectedInputOutput = JSON.parse(gptResponse.choices[0].message.content || "{}");
        const expectedInput = expectedInputOutput.stdin;
        const expectedOutput = expectedInputOutput.expected_output;

        console.log("the expected input and output for the code is : " , expectedInputOutput);

        //result from the judge0 api
        //send the code and language id , the input and the expected output to the judge0 api and get the result
        */

        const judge0RequestBody = {
            source_code : code,
            language_id : languageId,
        };

        const result = await fetch(JUDGE0_API_URL , {
            method : 'POST',
            headers : {
                'content-type' : 'application/json',
                'X-RapidAPI-Key': JUDGE0_API_KEY
            },
            body : JSON.stringify(judge0RequestBody)
        });

        if(!result.ok) {
            console.error("there was an error while sending the code payload request to the judge0api : " , result);
            return;
        }
        
        const resultData = await result.json();
        console.log("the result from the judge0 api is -------------------------: " , resultData);

        //status of the respons from the api>
        const resultStatus = resultData.status.description;
        const resultOutput = resultData.compile_output;
        const resultTime = resultData.time;
        const resultMemory = resultData.memory;

        //save to the supabase db the current result of the code execution>
        const supabase = getSupabaseClient();
        const {data , error} = await supabase
            .from('live_coding_questions')
            .update({
                question_id : submission.questionId,
                question : question,
                language : submission.language,
                code : submission.code,
                result : resultStatus,
                output : resultOutput,
                time : resultTime,
                memory : resultMemory,
                status : "checked"
            })
            .eq('interview_id' , submission.interviewId);

        if(error) {
            console.error("error updating the interview table with the resut of the execution of the code : " , error.message);
            return;
        }

        console.log("the result of the code execution is saved to the supabase db " , data);

        const publishingPayload = {
          questionId : submission.questionId,
          question : question,
          language : submission.language,
          code : submission.code,
          result : resultStatus,
          output : resultOutput,
          time : resultTime,
          memory : resultMemory,
          status : "checked"
        }

        console.log("the publishing payload is : " , publishingPayload);
        //publish to the redis pub sub channel.
        await this.publishResult(submission.questionId, publishingPayload);

        console.log("the result of the code execution is published to the redis pub sub channel successfully!!");

      } catch (error) {
        console.error('Error processing submission:', error);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
      }
    }
    
    await this.redisClient.disconnect();
    console.log('Worker shut down gracefully');
  }
  
  
  private async publishResult(submissionId: string, result: any): Promise<void> {
    await this.redisClient.publish(this.resultChannel, JSON.stringify({
      id: submissionId,
      timestamp: new Date().toISOString(),
      ...result
    }));
    console.log(`Published result for submission ${submissionId}`);
    console.log("the result published to the redis pub sub channel is : " , result);
  }
  
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('Shutting down worker...');
      await this.disconnect();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGHUP', shutdown);
  }
}

// Start the worker
async function main() {
  const worker = new CodeExecutionWorker();
  try {
    await worker.connect();
    await worker.start();
    console.log("the worker is started successfully!!");
  } catch (error) {
    console.error('Worker failed:', error);
    process.exit(1);
  }
}

main();
