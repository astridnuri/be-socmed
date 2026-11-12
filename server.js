// import dotenv from 'dotenv/config';
// import app from './src/app.js';

// dotenv.config();

// // const app = express();
// const PORT = process.env.PORT || 5000;

// // Baris ini HARUS ada agar server tidak langsung keluar/exit
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

import "dotenv/config"; // harus import pertama, sebelum app dan db

import app from "./src/app.js";

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));