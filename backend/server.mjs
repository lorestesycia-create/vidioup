// VidioUp V1 backend starter.
// Economic mutations must execute inside DB transactions in the deployed backend.
import express from 'express';
import crypto from 'crypto';
const app=express(); app.use(express.json());
const id=()=>crypto.randomUUID();
const ECON={welcome:100,reward:25,dailyRewardLimit:8,minBudget:100,maxBudget:50000,maxActive:5,cost:{basic:1,featured:2,boost:4}};
const PRODUCTS={coins_1000:1000,coins_3000:3000,coins_7000:7000,coins_16000:16000};

app.get('/health',(_,res)=>res.json({ok:true,service:'vidioup-api',version:'1'}));
app.get('/config',(_,res)=>res.json(ECON));

app.post('/videos/validate',(req,res)=>{
 const u=String(req.body.url||'');
 const valid=/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(u);
 res.status(valid?200:400).json({valid});
});

app.post('/campaigns/quote',(req,res)=>{
 const mode=req.body.mode, budget=Number(req.body.budget);
 if(!ECON.cost[mode]||budget<ECON.minBudget||budget>ECON.maxBudget)
   return res.status(400).json({error:'invalid_campaign'});
 res.json({mode,budget,cost_per_valid_internal_impression:ECON.cost[mode],max_impressions:Math.floor(budget/ECON.cost[mode])});
});

// The following endpoints deliberately require deployment adapters.
// Never trust userId, purchase success, rewarded success, or balances from the mobile client.
app.post('/campaigns/:id/activate',(_,res)=>res.status(501).json({error:'db_transaction_adapter_required'}));
app.post('/rewards/admob/verify',(_,res)=>res.status(501).json({error:'admob_server_verification_required'}));
app.post('/purchases/google/verify',(_,res)=>res.status(501).json({error:'google_play_server_verification_required'}));

app.listen(process.env.PORT||8080);
