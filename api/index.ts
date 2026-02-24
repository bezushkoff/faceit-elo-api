import type { VercelRequest, VercelResponse } from '@vercel/node';

// Хранение предыдущего Elo по никам (в памяти сервера)
let previousElo: Record<string, number> = {};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).json({ error: 'No nickname' });
  }

  try {
    const response = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${nick}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FACEIT_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const data = await response.json();
    const cs = data.games?.cs2 || data.games?.csgo;

    if (!cs) {
      return res.status(404).json({ error: 'CS game not found' });
    }

    const currentElo = cs.faceit_elo;

    // Берём предыдущий Elo или ставим текущее, если ещё нет
    const prev = previousElo[nick] ?? currentElo;
    const eloDiff = currentElo - prev;
    previousElo[nick] = currentElo;

    const eloDiffFormatted = (eloDiff > 0 ? '+' : '') + eloDiff;

    // Пока заглушки для Win/Lose (если не подключена база данных)
    const today = { win: 0, lose: 0 }; 

    const formatted = `Elo: ${currentElo} | Today → Win: ${today.win} Lose: ${today.lose} Elo: ${eloDiffFormatted}`;

    return res.status(200).send(formatted);

  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
