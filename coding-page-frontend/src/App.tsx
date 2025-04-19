import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { Editor } from '@monaco-editor/react';
import { debounce } from 'lodash';
import { useParams } from 'react-router-dom';

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
  const [questionId , setQuestionId] = useState('');
  const [question , setQuestion] = useState('');
  const [language , setLanguage] = useState('');

  const interviewId = useParams().interviewId || 'cdb368fb-0fcd-4785-91a3-759939c22530'; //get interview id from the url , hardcoded for testing purposes

  //TODO : remove the hardcoded interview id from the url and use the interview id from the param
  //TODO : one question is fetched and other code is overwritten with the same first one.
  //TODO : make somethihng such that after the first question is fetched  , the other question is fetched.

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
      setQuestionId(questionAndCodeData.questionId);
      setLanguage(questionAndCodeData.language);

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
    fetchQuestionAndCode().then(() => {
      // Once data is loaded, then establish WebSocket connection
      const ws = new WebSocket(WEBSOCKET_SERVER_URL);
      
      ws.onopen = () => {
        console.log("Connected to the ws server successfully");
        setSocket(ws);
      }
      
      ws.onmessage = (message) => {
        //whenever there is amessage from the server that is from the pub sub channel via the ws>
        try {
          const data = JSON.parse(message.data.toString());
          console.log("The data received from the ws server in the frontend is:", data);
          const { questionId: receivedQuestionId, interviewId: receivedInterviewId, question, result, output, time, memory} = data;
  
          if(receivedInterviewId === interviewId && receivedQuestionId === questionId) {
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
    });
  }, [questionId , interviewId]);


  useEffect(() => {
    fetchQuestionAndCode();
  },[]);

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

  
  return (
    <div className="app-container">
      <div className="question-section">
        <p>{question}</p>
      </div>
      <div className="editor-container">
        <Editor
          height="500px"
          defaultLanguage="javascript" //dynmically select
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
        <p>result : {result}</p>
        <p>status : {status}</p>
        <p>Time: {time} ms</p>
        <p>Memory: {memory} MB</p>
        <p>language : {language}</p>
      </div>
    </div>
  );
}

export default App;
