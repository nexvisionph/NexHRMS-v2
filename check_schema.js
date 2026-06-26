const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log("Checking database schema...");
  
  // 1. Check employees table columns
  const { data: empData, error: empErr } = await supabase.from('employees').select('*').limit(1);
  if (empErr) console.error("Error reading employees:", empErr.message);
  else {
    const keys = empData.length > 0 ? Object.keys(empData[0]) : [];
    console.log("Employees table exists. Columns include attendance_method:", keys.includes('attendance_method'));
  }

  // 2. Check work_locations table
  const { error: wlErr } = await supabase.from('work_locations').select('id').limit(1);
  if (wlErr) {
    console.log("work_locations table status:", wlErr.code === '42P01' ? "DOES NOT EXIST (Will be safely created)" : wlErr.message);
  } else {
    console.log("work_locations table ALREADY EXISTS.");
  }

  // 3. Check attendance_evidence columns
  const { data: evdData, error: evdErr } = await supabase.from('attendance_evidence').select('*').limit(1);
  if (evdErr) console.error("Error reading attendance_evidence:", evdErr.message);
  else {
    const keys = evdData.length > 0 ? Object.keys(evdData[0]) : [];
    console.log("attendance_evidence table exists. Columns include selfie_url:", keys.includes('selfie_url'));
  }

  // 4. Check attendance_logs columns
  const { data: logsData, error: logsErr } = await supabase.from('attendance_logs').select('*').limit(1);
  if (logsErr) console.error("Error reading attendance_logs:", logsErr.message);
  else {
    const keys = logsData.length > 0 ? Object.keys(logsData[0]) : [];
    console.log("attendance_logs table exists. Columns include attendance_status:", keys.includes('attendance_status'));
  }
}

checkSchema();
