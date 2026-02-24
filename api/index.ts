import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api", async (req, res) => {
  try {
    const apiKey = process.env.FACEIT_KEY;
    const nickname = process.env.FACEIT_NICK;

    if (!apiKey || !nickname) {
      return res.status(500).send("Missing FACEIT_KEY or FACEIT_NICK");
    }

    // Получаем player_id и текущий Elo
    const playerRes = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${nickname}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const playerData = await playerRes.json();
    const playerId = playerData.player_id;
    const currentElo = playerData.games?.cs2?.faceit_elo || 0;

    if (!playerId) {
      return res.status(404).send("Player not found");
    }

    // Получаем последние 20 матчей
    const matchesRes = await fetch(
      `https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&limit=20`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const matchesData = await matchesRes.json();
    const matches = matchesData.items || [];

    const todayDate = new Date().toISOString().split("T")[0];
    let win = 0;
    let lose = 0;
    let eloDiff = 0;

    for (const match of matches) {
      if (!match.finished_at || !match.match_id) continue;

      const matchDate = new Date(match.finished_at * 1000)
        .toISOString()
        .split("T")[0];

      if (matchDate !== todayDate) continue;

      try {
        const statsRes = await fetch(
          `https://open.faceit.com/data/v4/matches/${match.match_id}/stats`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );

        if (!statsRes.ok) continue;

        const statsData = await statsRes.json();

        const teams = statsData.teams || [];
        const players = teams.flatMap((team: any) => team.players || []);
        const me = players.find((p: any) => p.player_id === playerId);
        if (!me) continue;

        const result = me.player_stats?.Result;
        if (result === "1") win++;
        else if (result === "0") lose++;

        const before = Number(me.player_stats?.Elo_Before || 0);
        const after = Number(me.player_stats?.Elo_After || 0);
        eloDiff += after - before;

      } catch {
        continue; // если матч stats вернул ошибку, пропускаем
      }
    }

    const eloDiffFormatted = eloDiff > 0 ? `+${eloDiff}` : `${eloDiff}`;

    const formatted = `Elo: ${currentElo} | Today → Win: ${win} Lose: ${lose} Elo: ${eloDiffFormatted}`;

    return res.status(200).send(formatted);

  } catch (error) {
    console.error(error);
    return res.status(500).send("Server error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
