import express, { Request, Response } from "express"
import { config } from "dotenv"
import identify from "./identify"
import { PrismaClient } from "@prisma/client"

config()

const app = express()
const prisma = new PrismaClient()

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

app.get("/contacts", async (req: Request, res: Response): Promise<any> => {
    try {
        const allContacts = await prisma.contact.findMany({
            orderBy: {
                createdAt: 'asc'
            }
        })

        res.json({
            success: true,
            totalContacts: allContacts.length,
            contacts: allContacts
        })
    } catch (error) {
        console.error('Error in /contacts:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.listen(process.env.PORT || 8000, () => {
    console.log(`Listening at ${process.env.PORT || 8000}`)
})