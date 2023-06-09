const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000

app.use(express.json())
app.use(cors())

const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }

    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.SECREAT_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'Unauthorized access' })
        }
        req.decoded = decoded
        next();
    });
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@classes.s7axley.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection

        const popularClassesCollection = client.db("sportsmania").collection("popularclasses");
        const popularInstructorsCollection = client.db("sportsmania").collection("popularinstructors");
        const addedClassesCollection = client.db("sportsmania").collection("classes");
        const usersCollection = client.db("sportsmania").collection("users");

        app.post('/jwt', (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.SECREAT_TOKEN, { expiresIn: '1h' });
            const result = { token }
            res.send(result)
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }

        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existUser = await usersCollection.findOne(query);
            if (existUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get('/users', verifyJwt, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', verifyJwt, async (req, res) => {
            try {
                const email = req.params.email;
                if (req.decoded.email !== email) {
                    return res.send({ admin: false });
                }
                const query = { email: email };
                const user = await usersCollection.findOne(query);
                const result = { admin: user?.role === 'admin' };
                res.send(result);
            } catch (error) {
                console.log(error);
                res.status(500).send('Internal Server Error');
            }
        });


        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/users/admin', async (req, res) => {
            const email = req.body.email;
            const query = { email: email };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        app.post('/addedClasses', async (req, res) => {
            const addClass = req.body;
            const result = await addedClassesCollection.insertOne(addClass);
            res.send(result);
        })

        app.get('/classes', async (req, res) => {
            const result = await popularClassesCollection.find().toArray();
            res.send(result);
        })

        // app.get('/addedClasses', async (req, res) => {
        //     const result = await addedClassesCollection.find().toArray();
        //     res.send(result);
        // });

        app.get('/popularinstructors', async (req, res) => {
            const result = await popularInstructorsCollection.find().toArray();
            res.send(result);
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('welcome to sportsmania')
})

app.listen(port, () => {
    console.log(`listening on port ${port}`)
})