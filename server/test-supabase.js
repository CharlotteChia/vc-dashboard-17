import dotenv from 'dotenv';
import { getDataSourceRegistry } from './data-layer.js';

dotenv.config({ path: '.env' }); // Assuming execution from root

// Force data source to be SUPABASE for testing
process.env.DATA_SOURCE = 'SUPABASE';

async function testSupabase() {
    console.log(`Testing Supabase Connection...`);
    console.log(`URL: ${process.env.SUPABASE_URL}`);
    console.log(`Anon Key Length: ${process.env.SUPABASE_ANON_KEY ? process.env.SUPABASE_ANON_KEY.length : 'Missing'}`);

    try {
        const dataSource = getDataSourceRegistry();

        console.log('Fetching sales data from Supabase...');
        const data = await dataSource.getSalesData();

        console.log('✅ Connection Successful!');
        console.log(`Loaded ${data.length} records from Supabase.`);

        if (data.length > 0) {
            console.log('First record sample:', data[0]);
        } else {
            console.log('⚠️ The sales_data table exists but is currently empty.');
        }
    } catch (error) {
        console.error('❌ Supabase Connection Failed:');
        console.error(error.message);
    }
}

testSupabase();
