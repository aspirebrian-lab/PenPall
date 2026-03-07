import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Georgia', serif; /* Writer-friendly font */
    background-color: #f9f9f9;
    color: #333;
    line-height: 1.6;
  }

  h1, h2, h3 {
    font-family: 'Arial', sans-serif;
    color: #2c3e50;
  }

  button {
    cursor: pointer;
    border: none;
    border-radius: 4px;
    padding: 10px 15px;
    background-color: #3498db;
    color: white;
    font-size: 14px;
    transition: background-color 0.3s;
  }

  button:hover {
    background-color: #2980b9;
  }

  input, textarea {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px;
    font-size: 14px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .sidebar {
    width: 250px;
    background-color: #ecf0f1;
    padding: 20px;
    height: 100vh;
    position: fixed;
    left: 0;
    top: 0;
    overflow-y: auto;
  }

  .main-content {
    margin-left: 270px;
    padding: 20px;
  }
`;