import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).send('No nickname');
  }

  const apiKey = process.env.FACEIT_KEY;
  if (!apiKey) return res.status(500).send('No FACEIT_KEY');

  try {
    // Получаем игрока
    const playerRes = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${nick}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!playerRes.ok) return res.status(404).send('Player not found');

    const player = await playerRes.json();
    const playerId = player.player_id;

    const cs = player.games?.cs2 || player.games?.csgo;
    if (!cs) return res.status(404).send('CS not found');

    const currentElo = cs.faceit_elo;

    // Берём последний матч
    const historyRes = await fetch(
      `https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&limit=1`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const history = await historyRes.json();
    const lastMatch = history.items?.[0];

    if (!lastMatch) {
      return res.send(`Elo: ${currentElo}`);
    }

    // Получаем stats последнего матча
    const statsRes = await fetch(
      `https://open.faceit.com/data/v4/matches/${lastMatch.match_id}/stats`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!statsRes.ok) {
      return res.send(`Elo: ${currentElo}`);
    }

    const stats = await statsRes.json();
    const teams = stats.teams || [];
    const players = teams.flatMap((t: any) => t.players || []);
    const me = players.find((p: any) => p.player_id === playerId);

    if (!me || !me.player_stats) {
      return res.send(`Elo: ${currentElo}`);
    }

    const before = Number(me.player_stats.Elo_Before || 0);
    const after = Number(me.player_stats.Elo_After || 0);
    const result = me.player_stats.Result;

    const diff = after - before;
    const diffFormatted = diff > 0 ? `+${diff}` : `${diff}`;
    const winLose = result === '1' ? 'Win' : 'Lose';

    return res.send(
      `Elo: ${currentElo} | Last → ${winLose} ${diffFormatted}`
    );

  } catch (e) {
    console.error(e);
    return res.status(500).send('Error');
  }
}
