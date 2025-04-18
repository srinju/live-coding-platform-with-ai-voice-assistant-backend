import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { Editor } from '@monaco-editor/react';
import { debounce } from 'lodash';

function App() {

  const PRIMARY_BACKEND_URL = "http://localhost:3001";
  const WEBSOCKET_SERVER_URL = "ws://localhost:3000";

  const [socket , setSocket] = useState<WebSocket | null>(null);
  const [status , setStatus] = useState('unchecked'); //default status set to unchecked will be accepted or rejected based on the result of the executionof the code
  const [result , setResult] = useState('');
  const [output , setOutput] = useState('');
  const [code, setCode] = useState('');
  const [time , setTime] = useState(0);
  const [memory , setMemory] = useState(0);
  const [questionId , setQuestionId] = useState('59d1f479-f5aa-4785-aa93-9f4548f85049');
  const [question , setQuestion] = useState('');
  const [interviewId , setInterviewId] = useState('991cd08a-3e6d-4a64-861b-79e2364764a3'); //TODO : fetch the interview id for that interview and store it in the state using useParams or something like that
  const [language , setLanguage] = useState('JavaScript (Node.js 22.08.0)');

  //fetch the question , the interview id and the code from the db>
  const fetchQuestionAndCode = async() => {
    try {
      const questionAndCodeResponse = await fetch(`${PRIMARY_BACKEND_URL}/get-code-and-question` , {
        method : 'POST',
        headers : {
          'content-type' : 'application/json'
        },
        body : JSON.stringify({interviewId : interviewId})
      });

      if(!questionAndCodeResponse.ok) {
        console.error("there was an error occured while fetching the question and the code from the db : " , questionAndCodeResponse);
        return;
      }

      const questionAndCodeData = await questionAndCodeResponse.json();
      console.log("the question and the code from the request is  : " , questionAndCodeData);

      //set the question and the code in the state>
      setQuestion(questionAndCodeData.question);
      setCode(questionAndCodeData.code);

    } catch(err) {
      console.error("an error occured while fetching the question from the db : " , err);
    }
  }

  // Debounced function to send code to websocket
  const debouncedSendCode = useCallback(
    debounce((codeToSend: string) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const payload = {
          questionId,
          question,
          interviewId,
          code: codeToSend,
          language,
          status: 'unchecked'
        };
        console.log("Sending code to websocket:", payload);
        socket.send(JSON.stringify(payload));
        console.log("Code sent to websocket server after debounce");
      } else {
        console.log("Socket not ready:", socket?.readyState);
      }
    }, 2000), // 2 second debounce
    [socket, questionId, question, interviewId, language]
  );

  // Handle code changes
  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    debouncedSendCode(newCode);
  };
 
  useEffect(() => {
    console.log("Setting up WebSocket connection");
    const ws = new WebSocket(WEBSOCKET_SERVER_URL);

    ws.onopen = () => {
      setSocket(ws);
      console.log("Connected to the ws server successfully from the frontend");
    }

    ws.onmessage = (message) => {
      //whenever there is amessage from the server that is from the pub sub channel via the ws>
      try {
        const data = JSON.parse(message.data.toString());
        console.log("The data received from the ws server in the frontend is:", data);
        const { questionId: receivedQuestionId, question: receivedQuestion, result, output, time, memory} = data;

        if(receivedQuestionId === questionId) {
          setStatus(result);
          setOutput(output);
          setTime(time);
          setMemory(memory);
          setResult(result);
          //then displat the status and everything in the ui after the result is got from the pub sub channel via the ws server
        }
      } catch(err) {
        console.error("An error occurred while receiving the message from the ws server:", err);
      }
    }

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    }

    return () => {
      console.log("Cleaning up WebSocket connection");
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [questionId]);


  useEffect(() => {
    fetchQuestionAndCode();
  },[interviewId]);

  const runCode = async() => {
    try {
      console.log("Running code with:", { questionId, interviewId, language });
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

  //TODO : fetch the  interview id and store in the state using useParams or something like that
  //TODO : customize ui to show the output data in the ui output section (DESIGGN THE UI)
  //TODO : when the user types the code the code should be to the ws server //debound 2 seconds (DONE)
  //TODO : make a language select thingy (language should be the sleected one)
  //NOTE : status while submitting the code should be unchecked (for sending to ws server whenever the user writes something)
  //status : "unchecked"
  
  return (
    <div className="app-container">
      <div className="question-section">
        <p>{question}</p>
      </div>
      <div className="editor-container">
        <Editor
          height="500px"
          defaultLanguage="javascript"
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark" // Dark mode theme
        />
      </div>
      <div className="button-container">
        <button onClick={runCode}>Run</button>
      </div>
      <div className="output-container">
        <h3>Output:</h3>
        <pre>{output}</pre>
        <p>Time: {time} ms</p>
        <p>Memory: {memory} MB</p>
      </div>
    </div>
  );
}

export default App;
