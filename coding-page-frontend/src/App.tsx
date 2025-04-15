import React, { useState } from 'react';
import './App.css';
import { Editor } from '@monaco-editor/react';

function App() {
  const [code, setCode] = useState('// Write your code here');
  const [output, setOutput] = useState('');

  //web socket connection establish(TODO)
    //1.connect to the websocket server
    //2.send the code to the websocket server(partially done ones)
    //3.receive the messages from the websocket server
    


  //run the entire code to send request to primary backend /run-code (TODO)


  //display the output in the output section (TODO)

  const runCode = () => {
    //TODO: send request to the primary backend /run-code
  };

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
