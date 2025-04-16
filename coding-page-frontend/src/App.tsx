import React, { useEffect, useState } from 'react';
import './App.css';
import { Editor } from '@monaco-editor/react';

function App() {

  const PRIMARY_BACKEND_URL = "http://localhost:3001";
  const WEBSOCKET_SERVER_URL = "ws://localhost:3000";

  const [socket , setSocket] = useState<WebSocket | null>(null);
  const [status , setStatus] = useState('unchecked'); //default status set to unchecked will be accepted or rejected based on the result of the executionof the code
  const [result , setResult] = useState('');
  const [output , setOutput] = useState('');
  const [code, setCode] = useState('// Write your code here');
  const [time , setTime] = useState(0);
  const [memory , setMemory] = useState(0);
  const [questionId , setQuestionId] = useState('');
  const [question , setQuestion] = useState(''); //TODO : fetch the question for that interview and store it in the statee
  const [interviewId , setInterviewId] = useState(''); //TODO : fetch the interview id for that interview and store it in the state
  const [language , setLanguage] = useState('');


  useEffect(() => {

    const ws = new WebSocket(WEBSOCKET_SERVER_URL);

    ws.onopen = () => {
      setSocket(ws);
      console.log("connected to the ws server succesfully from the frontend");
    }

    ws.onmessage = (message) => {
      //whenever there is amessage from the server that is from the pub sub channel via the ws>
      try {

        const data = JSON.parse(message.data.toString());
        console.log("the data received from the ws server in the frontend  is : " , data);
        const { questionId , question , result , output , time , memory} = data;

        if(questionId === questionId) {
          setStatus(status);
          setOutput(output);
          setTime(time);
          setMemory(memory);
          setResult(result);
          //then displat the status and everything in the ui after the result is got from the pub sub channel via the ws server
        }

      } catch(err) {
        console.error("an error occcured while receiving the message from the ws server : " , err);
      }
    }

  },[questionId])
    

  const runCode = async() => {

    try {

      const response = await fetch(`${PRIMARY_BACKEND_URL}/run-code` , {
        method : 'POST',
        headers : {
          'content-type' : 'application/json'
        },
        body : JSON.stringify({
          questionId : questionId,
          question : question,
          interviewId : interviewId,
          code : code,
          language : language,
          status : status
        })
      });

      if(!response.ok) {
        console.error("there was an error occured while sending the request to run the code to the primary backend : " , response);
        return;
      }

      const responseData = await response.json();
      console.log('the response from the primaty backend /run-code is : ' , responseData);
      //the compiled code status will come from the ws coneciton with the redis pub sub channel

    } catch(err) {
      console.error("an error occured while sending the request to run the code to the primary backend : " , err);
    }
  };

  //TODO : fetch the quesiotn and the interview id and store in the state
  //TODO : customize ui to show the output data in the ui output section
  //TODO : when the user types the code the code should be to the ws server
  //TODO : make a language select thingy 
  //NOTE : status while submitting the code should be unchecked (for sending to ws server whenever the user writes something)

  return (
    <div className="app-container">
      <div className="question-section">
        <h2>Question (TODO) </h2>
      </div>
      <div className="editor-container">
        <Editor
          height="500px"
          defaultLanguage="javascript"
          value={code}
          onChange={(newValue) => setCode(newValue || '')}
          theme="vs-dark" // Dark mode theme
        />
      </div>
      <div className="button-container">
        <button onClick={runCode}>Run</button>
      </div>
      <div className="output-container">
        <h3>Output:</h3>
        <pre>{output}</pre>
      </div>
    </div>
  );
}

export default App;
