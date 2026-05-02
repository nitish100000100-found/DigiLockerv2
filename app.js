require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const DB_URL = process.env.DB_URL;
const User = require("./user.js");
const app = express();

cloudinary.config({ secure: true });

const uploadToCloudinary = (buffer, public_id) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "digilocker", public_id, overwrite: false },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png"];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.set("view engine", "ejs");
app.set("views", "views");

const store = new MongoDBStore({ uri: DB_URL, collection: "sessions" });

app.use(session({ secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true, store }));
app.use((req, res, next) => { req.isLoggedIn = req.session.isLoggedIn; next(); });
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => res.render("homepage", { errors: [] }));

app.post("/signinsubmit", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(400).render("homepage", { errors: ["User not found"] });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).render("homepage", { errors: ["Password not correct"] });

    req.session.isLoggedIn = true;
    req.session.username = user.username;
    res.redirect("/digilocker");
  } catch (err) {
    res.status(500).json({ message: "Signin not successful ❌", error: err.message });
  }
});

app.get("/digilocker", async (req, res) => {
  if (!req.isLoggedIn) return res.redirect("/");

  try {
    const username = req.session.username;
    const user = await User.findOne({ username }).lean();
    const excludedFields = ["_id", "username", "password", "__v"];
    const keys = Object.keys(user).filter((key) => !excludedFields.includes(key));
    res.render("digilocker", { keys, username });
  } catch (err) {
    console.log(err);
    res.status(500).send("Something went wrong");
  }
});

app.get("/signup", (req, res) => res.render("signup", { errors: [] }));

app.get("/logout", (req, res) => {
  if (!req.isLoggedIn) return res.redirect("/");
  req.session.isLoggedIn = false;
  res.render("homepage", { errors: [] });
});

app.post(
  "/signup",
  [
    body("name").notEmpty().withMessage("Name can't be empty"),
    body("username").notEmpty().withMessage("Username can't be empty"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("confirm_password").custom((value, { req }) => {
      if (value !== req.body.password) throw new Error("Passwords do not match");
      return true;
    }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("signup", { errors: errors.array().map((e) => e.msg) });
    }

    const { username, password } = req.body;
    bcrypt
      .hash(password, 12)
      .then((pass) => new User({ username, password: pass }).save())
      .then(() => res.redirect("/"))
      .catch(() => res.status(422).render("signup", { errors: ["User already exists"] }));
  }
);

app.get("/changepassword/:username", (req, res) => {
  if (!req.isLoggedIn) return res.redirect("/");
  res.render("changepass", { username: req.params.username, errors: [] });
});

app.post(
  "/change-password",
  [
    body("oldPassword").trim().notEmpty().withMessage("Previous password is required"),
    body("newPassword").trim().isLength({ min: 6 }).withMessage("Min 6 characters"),
    body("confirmPassword").trim().custom((value, { req }) => {
      if (value !== req.body.newPassword) throw new Error("Passwords must match");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("changepass", {
        username: req.session.username,
        errors: errors.array().map((e) => e.msg),
      });
    }

    try {
      const username = req.session.username;
      const user = await User.findOne({ username });
      const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);

      if (!isMatch) {
        return res.render("changepass", { username, errors: ["Old password is incorrect"] });
      }

      user.password = await bcrypt.hash(req.body.newPassword, 12);
      await user.save();
      res.redirect("/digilocker");
    } catch (err) {
      console.log(err);
      res.send("Something went wrong");
    }
  }
);

app.get("/addpass/:username", (req, res) => {
  if (!req.isLoggedIn) return res.redirect("/");
  res.render("addpass", { username: req.params.username, errors: [] });
});

app.post(
  "/adddpass/:username",
  [
    body("key").trim().notEmpty().withMessage("Key cannot be empty"),
    body("value").trim().notEmpty().withMessage("Password cannot be empty"),
  ],
  async (req, res) => {
    const username = req.params.username;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render("addpass", { username, errors: errors.array() });
    }

    try {
      const { key, value } = req.body;
      const user = await User.findOne({ username });

      user.set(key + "thisistext", value);
      await user.save();

      const keys = Object.keys(user.toObject()).filter(
        (k) => !["_id", "username", "password", "__v"].includes(k)
      );

      res.render("digilocker", { keys, username });
    } catch (err) {
      console.log(err);
      res.send("Can't add password");
    }
  }
);

app.get("/getdoc/:username/:key", async (req, res) => {
  if (!req.session.isLoggedIn) return res.redirect("/");

  const { username, key } = req.params;

  try {
    const user = await User.findOne({ username });

    if (key.includes("thisistext")) {
      res.render("passlook", { username, key, value: user[key] });
    } else {
      const doc = user[key];
      const value = typeof doc === "string" ? doc : doc.url;
      res.render("getdoc", { username, key, value });
    }
  } catch (err) {
    console.log(err);
    res.send("Something went wrong");
  }
});

app.get("/adddoc/:username", (req, res) => {
  if (!req.session.isLoggedIn) return res.redirect("/");
  res.render("adddoc", { username: req.params.username });
});

app.post("/adddoc/:username", upload.single("photo"), async (req, res) => {
  const { username } = req.params;
  const { docName } = req.body;

  try {
    const user = await User.findOne({ username });
    const public_id = `${username}-${docName}-${Date.now()}`;
    const result = await uploadToCloudinary(req.file.buffer, public_id);

    user.set(docName, { url: result.secure_url, public_id: result.public_id });
    await user.save();

    res.redirect("/digilocker");
  } catch (err) {
    console.error(err);
    res.send("Some error occurred");
  }
});

app.post("/deletePassword/:username/:key", async (req, res) => {
  if (!req.session.isLoggedIn) return res.redirect("/");
  const { username, key } = req.params;

  await User.updateOne({ username }, { $unset: { [key]: "" } });
  res.redirect("/digilocker");
});

app.post("/deleteDoc/:username/:key", async (req, res) => {
  if (!req.session.isLoggedIn) return res.redirect("/");
  const { username, key } = req.params;

  try {
    const user = await User.findOne({ username });
    const doc = user[key];

    if (doc && typeof doc === "object" && doc.public_id) {
      await cloudinary.uploader.destroy(doc.public_id);
    }

    await User.updateOne({ username }, { $unset: { [key]: "" } });
    res.redirect("/digilocker");
  } catch (error) {
    console.log("Something went wrong:", error);
    res.send("Error deleting document");
  }
});

mongoose
  .connect(DB_URL)
  .then(() => {
    console.log("Connected to Mongo");
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
    });
  })
  .catch((err) => console.log("Mongo connection error:", err));