import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  :root {
    color-scheme: light;
    --page-bg: #f3efe8;
    --surface: #ffffff;
    --surface-soft: #faf7f2;
    --text-strong: #18212b;
    --text: #2f3a45;
    --text-muted: #616e7c;
    --line: rgba(24, 33, 43, 0.12);
    --line-strong: rgba(24, 33, 43, 0.2);
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    min-width: 320px;
    font-family: 'Avenir Next', 'Segoe UI', sans-serif;
    background: var(--page-bg);
    color: var(--text);
    line-height: 1.6;
  }

  body,
  button,
  input,
  textarea {
    font: inherit;
  }

  img,
  svg {
    display: block;
    max-width: 100%;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  h1,
  h2,
  h3 {
    font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    color: var(--text-strong);
    letter-spacing: -0.02em;
  }

  button {
    cursor: pointer;
    border: 1px solid transparent;
    background: var(--surface);
    color: var(--text-strong);
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
    color: var(--text-strong);
    padding: 12px 14px;
    outline: none;
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }

  input::placeholder,
  textarea::placeholder {
    color: #8a94a0;
  }

  input:focus,
  textarea:focus {
    border-color: rgba(24, 33, 43, 0.26);
    box-shadow: 0 0 0 4px rgba(24, 33, 43, 0.08);
    background: #ffffff;
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