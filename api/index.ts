import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).json({ error: 'No nickname' });
  }

  try {
    const apiKey = process.env.FACEIT_KEY;
    if (!apiKey) return res.status(500).json({ error: 'FACEIT_KEY not set' });

    // Получаем данные игрока
    const playerRes = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${nick}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!playerRes.ok) return res.status(404).json({ error: 'Player not found' });

    const playerData: any = await playerRes.json();
    const playerId: string = playerData.player_id;
    const cs = playerData.games?.cs2 || playerData.games?.csgo;

    if (!cs) return res.status(404).json({ error: 'CS game not found' });

    const currentElo: number = cs.faceit_elo;

    // Получаем историю последних 10 матчей
    const matchesRes = await fetch(
      `https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&limit=10`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const matchesData: any = await matchesRes.json();
    const matches: any[] = matchesData.items || [];

    const today = new Date().toISOString().split('T')[0];

    let win = 0, lose = 0, eloDiff = 0;

    for (const match of matches) {
      if (!match.finished_at || !match.match_id) continue;

      const matchDate = new Date(match.finished_at * 1000).toISOString().split('T')[0];
      if (matchDate !== today) continue; // только сегодняшние матчи

      try {
        const statsRes = await fetch(
          `https://open.faceit.com/data/v4/matches/${match.match_id}/stats`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!statsRes.ok) continue;

        const statsData: any = await statsRes.json();
        const teams: any[] = statsData.teams || [];
        const players: any[] = teams.flatMap(t => t.players || []);
        const me: any = players.find(p => p.player_id === playerId);

        if (!me || !me.player_stats) continue;

        // Считаем результат
        const result = me.player_stats.Result;
        if (result === '1') win++;
        else if (result === '0') lose++;

        const before = Number(me.player_stats.Elo_Before || 0);
        const after = Number(me.player_stats.Elo_After || 0);
        eloDiff += after - before;

      } catch {
        continue; // если матч stats пустой, пропускаем
      }
    }

    const eloDiffFormatted = eloDiff > 0 ? `+${eloDiff}` : `${eloDiff}`;
    const formatted = `Elo: ${currentElo} | Today → Win: ${win} Lose: ${lose} Elo: ${eloDiffFormatted}`;

    return res.status(200).send(formatted);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}
