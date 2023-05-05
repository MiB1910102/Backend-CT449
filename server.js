const express = require("express");
const app = express();
const config = require("./app/config");
const MongoDB = require("./app/utils/mongodb.util");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
app.use(express.json());
async function startServer() {
  try {
    const client = await MongoDB.connect(config.db.uri);
    console.log("Connected to MongoDB");
    app.get("/api/products", async (req, res) => {
      try {
        // Query the database
        const db = client.db();
        const products = await db.collection("products").find({}).toArray();
        res.status(200).json(products);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.get("/api/users/:userId/cart", async (req, res) => {
      const { userId } = req.params;
      try {
        // Query the database
        const db = client.db();
        const user = await db.collection("users").findOne({ id: userId });
        if (!user) return res.status(404).json("Conuld not find user!");
        const products = await db.collection("products").find({}).toArray();
        const cartItemIds = user.cartItems;
        const cartItems = cartItemIds.map((id) => {
          console.log(id);
          return products.find((product) => product.id === id);
        });
        res.status(200).json(cartItems);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.get("/api/products/:productId", async (req, res) => {
      const { productId } = req.params;
      const db = client.db();
      const products = await db.collection("products").find({}).toArray();
      const product = products.find((product) => product.id === productId);
      if (product) {
        res.status(200).json(product);
      } else {
        res.status(404).json("Could not find the product!");
      }
    });
    app.post("/api/users/:userId/cart", async (req, res) => {
      try {
        const { userId } = req.params;
        console.log(userId);
        const { productId } = req.body || {};
        if (!productId) {
          return res
            .status(400)
            .json({ message: "productId is missing from the request body" });
        }
        const db = client.db();
        await db.collection("users").updateOne(
          { id: userId },
          {
            $addToSet: { cartItems: productId },
          },
          { upsert: true } // create a new document if it doesn't exist
        );
        const user = await db.collection("users").findOne({ id: userId });
        const products = await db.collection("products").find({}).toArray();
        const cartItemIds = user.cartItems;
        const cartItems = cartItemIds.map((id) =>
          products.find((product) => product.id === id)
        );
        res.status(200).json(cartItems);
      } catch (error) {
        console.log(error);
        res.status(404).json({ message: "Could not find the product!" });
      }
    });
    app.delete("/api/users/:userId/cart/:productId", async (req, res) => {
      try {
        const { userId, productId } = req.params;
        const db = client.db();
        await db.collection("users").updateOne(
          { id: userId },
          {
            $pull: { cartItems: productId },
          }
        );
        const user = await db.collection("users").findOne({ id: userId });
        const cartItemIds = user.cartItems;
        const products = await db.collection("products").find({}).toArray();
        const cartItems = cartItemIds.map((id) =>
          products.find((product) => product.id === id)
        );
        res.status(200).json(cartItems);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.get("/api/users/:userId/orthers", async (req, res) => {
      console.log("vô tới đây");
      const { userId } = req.params;
      console.log(userId);
      const db = client.db();
      const orders = await db.collection("orthers").find({ userId }).toArray();
      res.status(200).json(orders);
    });
    app.post("/api/users/:userId/orthers", async (req, res) => {
      const { userId } = req.params;
      const { name, email, address, cartItems, totalPrice } = req.body;
      const db = client.db();
      const date = new Date();
      const dateNow = date.toISOString().slice(0, -5);
      const order = {
        userId: userId,
        name: name,
        email: email,
        address: address,
        cartItems: cartItems,
        totalPrice: totalPrice,
        date: dateNow,
      };
      const result = await db.collection("orthers").insertOne(order);
      res.status(200).json(result);
    });
    app.post("/api/signup",[
        // Validate input fields
        body("name").notEmpty().withMessage("Name is required"),
        body("email").isEmail().withMessage("Invalid email").normalizeEmail(),
        body("password")
          .isLength({ min: 6 })
          .withMessage("Password must be at least 6 characters"),
      ],

      async (req, res) => {
        console.log(req.body.name);
        console.log(req.body.email);
        console.log(req.body.password);
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(422).json({ errors: errors.array() });
        }

        try {
          const db = client.db();
          // Check if user already exists with provided email
          const existingUser = await db
            .collection("users")
            .findOne({ email: req.body.email });
          if (existingUser) {
            return res
              .status(409)
              .json({ message: "User with this email already exists" });
          }
          // Hash password before storing in the database
          const hashedPassword = await bcrypt.hash(req.body.password, 10);
          // Create a new user object

          const cartItems = [];
          const newUser = {
            id: uuidv4(),
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            cartItems: cartItems,
          };
          // Insert the new user into the database
          const result = await db.collection("users").insertOne(newUser);
          res.status(200).json(result);
        } catch (error) {
          console.log(error);
          res.status(500).json({ message: "Internal server error" });
        }
      }
    );
    app.post("/api/login", async (req, res) => {
      try {
        const db = client.db();
        // Check if user exists with provided email
        const user = await db
          .collection("users")
          .findOne({ email: req.body.email });
        if (!user) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        // Compare hashed password with user input
        const validPassword = await bcrypt.compare(
          req.body.password,
          user.password
        );
        if (!validPassword) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        const result = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
        res.status(200).json({ result });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.listen(config.app.port, () => {
      console.log(`Server is running on port ${config.app.port}`);
    });
  } catch (error) {
    console.log("Cannot connect to MongoDB", error);
    process.exit();
  }
}
startServer();
