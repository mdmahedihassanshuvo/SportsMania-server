const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.SECREATE_KEY)
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
        // await client.connect();
        // Send a ping to confirm a successful connection

        const popularClassesCollection = client.db("sportsmania").collection("popularclasses");
        const popularInstructorsCollection = client.db("sportsmania").collection("popularinstructors");
        const addedClassesCollection = client.db("sportsmania").collection("classes");
        const usersCollection = client.db("sportsmania").collection("users");
        const selectedClassesCollection = client.db("sportsmania").collection("selectedClasses");
        const paymentsCollection = client.db("sportsmania").collection("payments");

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

        app.get('/users', async (req, res) => {
            const role = req.query.role;
            // console.log(role);
            if (!role) {
                const result = await usersCollection.find().toArray();
                res.send(result);
            } else {
                const query = { role: role };
                const result = await usersCollection.find(query).toArray();
                res.send(result);
            }
            // const result = await usersCollection.find().toArray();
            // res.send(result);
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

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            // console.log(email);
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })


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

        app.get('/addedClasses', async (req, res) => {
            const status = req.query.status;
            const email = req.query.email;
            // console.log(email);

            if (!status && !email) {
                const result = await addedClassesCollection.find().toArray();
                res.send(result);
            } else if (status && !email) {
                const query = { status: status };
                const result = await addedClassesCollection.find(query).toArray();
                res.send(result);
            } else if (!status && email) {
                const query = { email: email };
                const result = await addedClassesCollection.find(query).toArray();
                res.send(result);
            } else {
                const query = { status: status, email: email };
                const result = await addedClassesCollection.find(query).toArray();
                res.send(result);
            }
        });

        app.patch('/addedClasses', async (req, res) => {
            const id = req.query.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };

            try {
                const classItem = await addedClassesCollection.findOne(filter);
                if (!classItem) {
                    return res.status(404).json({ error: 'Class not found' });
                }

                let availableSeats = parseInt(classItem.available_seats);

                if (isNaN(availableSeats)) {
                    return res.status(500).json({ error: 'Invalid available_seats value' });
                }

                availableSeats--;

                const updateDoc = {
                    $set: { available_seats: availableSeats.toString() }
                };

                const result = await addedClassesCollection.updateOne(filter, updateDoc);

                if (result.modifiedCount === 0) {
                    return res.status(500).json({ error: 'Failed to update class' });
                }

                res.sendStatus(200);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.patch('/addedClasses/:id', async (req, res) => {
            const status = req.body.status
            // console.log(status)
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    status: status,
                },
            };

            const result = await addedClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.put('/addedClasses/:id', async (req, res) => {
            const feedBack = req.body.feedBack
            // console.log(feedBack)
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    feedBack: feedBack,
                },
            };

            const result = await addedClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.post('/selectClasses/:email', async (req, res) => {
            const selectedClasses = req.body;
            const result = await selectedClassesCollection.insertOne(selectedClasses);
            res.send(result);
        })

        // app.get('/selectClasses/:email', async (req, res) => {
        //     const email = req.params.email
        //     const query = { email: email }
        //     const result = await selectedClassesCollection.find(query).toArray();
        //     res.send(result);
        // })

        app.get('/selectClasses', async (req, res) => {
            const id = req.query.id;
            const email = req.query.email;
            // console.log(email)

            if (id) {
                const query = { _id: new ObjectId(id) }
                const result = await selectedClassesCollection.find(query).toArray();
                res.send(result);
            }

            else if (email) {
                query = { email: email }
                const result = await selectedClassesCollection.find(query).toArray();
                res.send(result);
            }



        });


        app.get('/classes', async (req, res) => {
            const result = await popularClassesCollection.find().toArray();
            res.send(result);
        })

        app.get('/popularinstructors', async (req, res) => {
            const result = await popularInstructorsCollection.find().toArray();
            res.send(result);
        })

        app.post('/create-payment-intent', verifyJwt, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);

            const query = { _id: new ObjectId(payment.classItemId) }
            // console.log(query)
            const deletedItem = await selectedClassesCollection.deleteOne(query);

            res.send({ result, deletedItem })
        })

        app.get('/payments/:email', async (req, res) => {
            const email = req.params.email
            const query = {email : email}
            const result = await paymentsCollection.find(query).toArray();
            res.send(result)
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