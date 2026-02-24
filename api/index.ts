import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).json({ error: 'No nickname' });
  }

  try {
    // 1️⃣ Получаем игрока
    const playerRes = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${nick}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FACEIT_KEY}`,
        },
      }
    );

    if (!playerRes.ok) {
      return res.status(404).send('Player not found');
    }

    const playerData = await playerRes.json();
    const playerId = playerData.player_id;
    const cs = playerData.games?.cs2 || playerData.games?.csgo;

    if (!cs) {
      return res.status(404).send('CS game not found');
    }

    const currentElo = cs.faceit_elo;

    // 2️⃣ Получаем последние матчи
    const matchesRes = await fetch(
      `https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FACEIT_KEY}`,
        },
      }
    );

    const matchesData = await matchesRes.json();
    const matches = matchesData.items || [];

    const todayDate = new Date().toISOString().split('T')[0];

    let win = 0;
    let lose = 0;
    let eloDiff = 0;

    for (const match of matches) {
      const matchDate = new Date(match.finished_at * 1000)
        .toISOString()
        .split('T')[0];

      if (matchDate !== todayDate) continue;

      if (match.stats?.result === '1') {
        win++;
      } else {
        lose++;
      }

      const before = match.stats?.elo_before ?? 0;
      const after = match.stats?.elo_after ?? 0;
      eloDiff += after - before;
    }

    const eloDiffFormatted =
      eloDiff > 0 ? `+${eloDiff}` : `${eloDiff}`;

    const formatted = `Elo: ${currentElo} | Today → Win: ${win} Lose: ${lose} Elo: ${eloDiffFormatted}`;

    return res.status(200).send(formatted);

  } catch (error) {
    return res.status(500).send('Server error');
  }
}
