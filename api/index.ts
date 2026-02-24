npm install node-fetch @types/node-fetch
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
    // -------------------------
    // 1. Получаем игрока
    // -------------------------
    const playerRes = await fetch(
      https://open.faceit.com/data/v4/players?nickname=${nick},
      {
        headers: {
          Authorization: Bearer ${process.env.FACEIT_KEY},
        },
      }
    );

    if (!playerRes.ok) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = await playerRes.json();

    const cs =
      player.games?.cs2 ||
      player.games?.csgo;

    if (!cs) {
      return res.status(404).json({ error: 'CS game not found' });
    }

    const playerId = player.player_id;
    const currentElo = cs.faceit_elo;

    // -------------------------
    // 2. История матчей
    // -------------------------
    const historyRes = await fetch(
      https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&limit=20,
      {
        headers: {
          Authorization: Bearer ${process.env.FACEIT_KEY},
        },
      }
    );

    const historyData = await historyRes.json();
    const matches = historyData.items || [];

    // -------------------------
    // 3. Сегодняшняя дата
    // -------------------------
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let win = 0;
    let lose = 0;
    let eloDiffToday = 0;

    for (const match of matches) {
      const matchDate = new Date(match.finished_at * 1000);

      if (matchDate < today) continue;

      const stats = match.stats;

      if (!stats) continue;

      const result = stats.result; // WIN / LOSE
      const eloChange = Number(stats.rating_delta) || 0;

      eloDiffToday += eloChange;

      if (result === 'WIN') win++;
      if (result === 'LOSE') lose++;
    }

    // -------------------------
    // 4. Форматирование
    // -------------------------
    const eloDiffFormatted =
      eloDiffToday > 0
        ? +${eloDiffToday}
        : ${eloDiffToday};

    const output =
      Elo: ${currentElo} | Today → Win: ${win} Lose: ${lose} ΔElo: ${eloDiffFormatted};

    return res.status(200).send(output);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
