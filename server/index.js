import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDataSourceRegistry } from './data-layer.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize data source
const dataSource = getDataSourceRegistry();

app.get('/api/sales', async (req, res) => {
    try {
        const data = await dataSource.getSalesData();
        res.json(data);
    } catch (err) {
        console.error('Error fetching sales data:', err);
        res.status(500).json({ error: 'Failed to fetch sales data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Using data source: ${process.env.DATA_SOURCE || 'CSV'}`);
});
