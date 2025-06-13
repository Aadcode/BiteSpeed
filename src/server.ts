import express, { Request, Response } from "express"
import { config } from "dotenv"
import identify from "./identify"

config()

const app = express()

// Add middleware to parse JSON bodies
app.use(express.json())

app.post("/identify", async (req: Request, res: Response): Promise<any> => {
    try {
        const body = req.body
        const result = await identify(body)
        res.json(result)
    } catch (error) {
        console.error('Error in /identify:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.listen(process.env.PORT || 8000, () => {
    console.log(`Listening at ${process.env.PORT || 8000}`)
})