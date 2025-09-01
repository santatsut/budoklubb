import express from 'express';
import mysql from 'mysql2/promise';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';

const app = express();
const port = 5001;

const saltRounds = 5; // Cost factor - higher means more secure, but slower

app.use(cors());
app.use(bodyParser.json());


// Middleware to parse JSON data
app.use(bodyParser.json());

// MySQL connection settings
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123123', // Your MySQL password
  database: 'idrottsklubb'
};

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
  
app.post('/signUp', async (req, res) => {
    const { firstName, lastName, number, gmail, password } = req.body;
  
    // Create MySQL connection
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log(`Received: ${gmail} ${password}`);

      // Check if the user already exists
      //const checkQuery = 'SELECT * FROM users WHERE gmail = ?';
      // Use parameterized query to prevent SQL injection
      const checkQuery = `SELECT * FROM users WHERE gmail = '${gmail}'`;


      const [rows] = await connection.execute(checkQuery, [gmail]);
      if (rows.length > 0) {
        return res.status(400).json({ message: 'User already exists' });
      }

      
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Insert query to add the cart item
      const query = `INSERT INTO users (firstName, lastName, number, gmail, password) VALUES (?, ?, ?, ?, ?)`;
      // Use parameterized query to prevent SQL injection
      const [result] = await connection.execute(query, [firstName, lastName, number, gmail, hashedPassword]);
      
      // Send a success response
      res.status(201).json({ message: 'user registered', gmail, password });
    } catch (error) {
      console.error('Error adding user:', error);
      res.status(500).json({ message: 'Error adding user', error: error.message });
    } finally {
      if (connection) await connection.end();
    }
  });

  app.post('/checkLogin', async (req, res) => {
    const { gmail, password } = req.body;
    let connection;
  
    try {
      connection = await mysql.createConnection(dbConfig);
  
      // Fetch the user by email
      const query = `SELECT * FROM users WHERE gmail = ?`;
      const [rows] = await connection.execute(query, [gmail]);
  
      if (rows.length === 0) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
  
      const user = rows[0];
      const storedHash = user.password;
  
      // Compare the input password with the stored hashed password
      const isMatch = await bcrypt.compare(password, storedHash);
  
      if (isMatch) {
        res.json({ success: true, message: 'Login successful' });
      } else {
        res.status(401).json({ success: false, message: 'Incorrect password' });
      }
  
    } catch (error) {
      console.error("Login check error:", error);
      res.status(500).json({ success: false, message: "Error checking login" });
    } finally {
      if (connection) await connection.end();
    }
  });

  app.post("/getUser", async (req, res) => {
    const { gmail } = req.body;
    console.log(`Received: ${gmail}`);
    let connection;
  
    try {
      connection = await mysql.createConnection(dbConfig);
  
      // Use parameterized query to prevent SQL injection
      const query = `SELECT * FROM users WHERE gmail = ?`;
      const [rows] = await connection.execute(query, [gmail]);
  
      if (rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const user = rows[0];
      res.json({
        success: true,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          // add more fields here if needed
        }
      });
      
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ success: false, message: "Error fetching user" });
    } finally {
      if (connection) await connection.end();
    }
  });
  

app.post("/api/swishcb/paymentrequests", async (req, res) => {
  console.log("Swish callback received:", req.body);

  const { id, status, amount, payerAlias } = req.body;  // Extract data from Swish

  if (!id || !status) {
    return res.status(400).json({ error: "Invalid Swish callback data" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // ✅ Store the payment in the database
    const query = `INSERT INTO payments (transaction_id, status, amount, payerAlias) VALUES (?, ?, ?, ?)`;
    await connection.execute(query, [id, status, amount, payerAlias]);

    await connection.end();

    console.log("Payment recorded successfully");
    res.status(200).send("OK");  // ✅ Swish requires a 200 response
  } catch (error) {
    console.error("Error processing Swish callback:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

