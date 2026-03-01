# Writers Companion Application

## Overview
The Writers Companion Application is designed to assist writers in creating and managing their books. It features a text editor for book creation, an AI chatbox for editing suggestions, and a story panel that helps users navigate through their story structure.

## Features
- **Text Editor**: A rich text editor for writing and formatting book content.
- **AI Chatbox**: An interactive chatbox that provides editing suggestions and feedback on the user's writing.
- **Story Panel**: A visual representation of the overall story structure, allowing users to navigate through chapters and sections easily.
- **Context Awareness**: The AI understands the entire story, providing relevant suggestions based on the context of the narrative.

## Project Structure
```
writers-companion-app
├── client
│   ├── src
│   │   ├── components
│   │   ├── hooks
│   │   ├── pages
│   │   ├── services
│   │   └── types
│   ├── package.json
│   └── tsconfig.json
├── server
│   ├── src
│   │   ├── app.ts
│   │   ├── db
│   │   ├── models
│   │   ├── routes
│   │   ├── services
│   │   └── types
│   ├── package.json
│   └── tsconfig.json
├── .env.example
├── package.json
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd writers-companion-app
   ```
3. Install dependencies for both client and server:
   ```
   cd client && npm install
   cd ../server && npm install
   ```

## Usage
1. Start the server:
   ```
   cd server
   npm start
   ```
2. Start the client:
   ```
   cd client
   npm start
   ```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.