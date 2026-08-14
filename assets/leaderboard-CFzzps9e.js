import{q as i}from"./turso-BHq-LiaW.js";function o(t){const e=new Date(t),a=e.getDay(),s=e.getDate()-a+(a===0?-6:1);return e.setDate(s),e.setHours(0,0,0,0),e.toISOString().split("T")[0]}async function p(t,e,a,s){const r=o(new Date);try{return await i("INSERT INTO points_ledger (player_id, points, reason, match_id, week_start_date) VALUES (?, ?, ?, ?, ?)",[t,e,a,s??null,r]),await i("UPDATE players SET total_points = total_points + ?, total_wins = total_wins + 1 WHERE id = ?",[e,t]),{success:!0}}catch(n){return console.error("Failed to award points:",n),{success:!1,error:n.message}}}async function d(t){const e=o(t||new Date);try{return{data:(await i(`
      SELECT
        p.id as player_id,
        COALESCE(p.preferred_name, p.first_name) as player_name,
        SUM(pl.points) as points,
        COUNT(*) as wins
      FROM players p
      JOIN points_ledger pl ON p.id = pl.player_id
      WHERE pl.week_start_date = ?
      GROUP BY p.id
      ORDER BY points DESC
    `,[e])).rows.map((r,n)=>({playerId:r.player_id,playerName:r.player_name,points:Number(r.points),wins:Number(r.wins),rank:n+1}))}}catch(a){return{error:a.message}}}async function _(){try{return{data:(await i("SELECT id, first_name, preferred_name, total_points, total_wins FROM players WHERE total_points > 0 AND is_deleted = 0 ORDER BY total_points DESC")).rows.map((e,a)=>({playerId:e.id,playerName:e.preferred_name||e.first_name,points:Number(e.total_points),wins:Number(e.total_wins),rank:a+1}))}}catch(t){return{error:t.message}}}export{p as a,_ as b,d as c,o as g};
