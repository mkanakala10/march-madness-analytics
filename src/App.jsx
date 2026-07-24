import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, BarChart2, ShieldAlert, RefreshCw, X, Award, CheckCircle, Target, Cpu, BookOpen } from 'lucide-react';
import { predictMatchup } from './predictor.js';

// Import JSON data directly (handled out-of-the-box by Vite)
import modelsData from '../models.json';
import teams2025 from '../teams_2025.json';
import teamsHistorical from '../teams_historical.json';
import matchups2025 from '../matchups_2025.json';

// Feature explanations for tooltips/help
const featureDescriptions = {
  "SEED": "NCAA Tournament Seed (1 to 16). Lower seeds are stronger teams.",
  "WAB": "Wins Above Bubble: The number of wins a team has compared to a bubble team. Higher is better.",
  "BARTHAG": "Barthag rating: The probability a team would beat an average D-1 opponent. Range 0 to 1.",
  "TR RANK": "Team Rankings Rank: Overall rank based on performance models. Lower is better.",
  "BADJ EM": "Adjusted Efficiency Margin: Net efficiency of points scored/allowed per 100 possessions.",
  "LAST": "Consistency Last: Ranking based on final regular season performances. Lower is better.",
  "FT%": "Free Throw Percentage: Efficiency from the free-throw line.",
  "AST%": "Assist Percentage: Percentage of field goals that were assisted (indicates ball movement).",
  "CONSISTENCY TR RATING": "Team Rankings Consistency Rating. Measures variance in game-to-game quality.",
  "EXP": "Average experience of players on the roster (in years)."
};

// Hardcoded feature importances from Random Forest model (based on Python training run)
const featureImportances = [
  { feature: "WAB_TEAM1", label: "Wins Above Bubble (Team 1)", value: 0.0766 },
  { feature: "WAB_TEAM2", label: "Wins Above Bubble (Team 2)", value: 0.0699 },
  { feature: "BARTHAG_TEAM2", label: "Barthag Power Rating (Team 2)", value: 0.0682 },
  { feature: "TR RANK_TEAM2", label: "Team Rankings Rank (Team 2)", value: 0.0674 },
  { feature: "BADJ EM_TEAM2", label: "Adj. Efficiency Margin (Team 2)", value: 0.0596 },
  { feature: "BADJ EM_TEAM1", label: "Adj. Efficiency Margin (Team 1)", value: 0.0543 },
  { feature: "LAST_TEAM2", label: "Consistency Last Rank (Team 2)", value: 0.0537 },
  { feature: "FT%_TEAM1", label: "Free Throw % (Team 1)", value: 0.0514 },
  { feature: "BARTHAG_TEAM1", label: "Barthag Power Rating (Team 1)", value: 0.0507 },
  { feature: "AST%_TEAM1", label: "Assist % (Team 1)", value: 0.0498 },
  { feature: "CONSISTENCY_TEAM1", label: "Consistency Rating (Team 1)", value: 0.0458 },
  { feature: "AST%_TEAM2", label: "Assist % (Team 2)", value: 0.0449 },
  { feature: "FT%_TEAM2", label: "Free Throw % (Team 2)", value: 0.0447 },
  { feature: "EXP_TEAM2", label: "Experience (Team 2)", value: 0.0442 },
  { feature: "EXP_TEAM1", label: "Experience (Team 1)", value: 0.0435 },
  { feature: "LAST_TEAM1", label: "Consistency Last Rank (Team 1)", value: 0.0387 },
  { feature: "CONSISTENCY_TEAM2", label: "Consistency Rating (Team 2)", value: 0.0377 },
  { feature: "TR RANK_TEAM1", label: "Team Rankings Rank (Team 1)", value: 0.0356 },
  { feature: "SEED_TEAM1", label: "Tournament Seed (Team 1)", value: 0.0349 },
  { feature: "SEED_TEAM2", label: "Tournament Seed (Team 2)", value: 0.0285 }
].sort((a, b) => b.value - a.value);

// Simulation Helper
function simulateRound(matchups, modelType, modelsData, statsMap, chaosFactor = 0.0) {
  const results = [];
  const winners = [];

  matchups.forEach((match) => {
    const t1 = match.TEAM1;
    const t2 = match.TEAM2;
    const t1Stats = statsMap[t1] || { TEAM: t1, SEED: 16, WAB: 0, "FT%": 70, "CONSISTENCY TR RATING": 10, EXP: 2, "BADJ EM": 0, "TR RANK": 150, BARTHAG: 0.5, LAST: 150, "AST%": 50 };
    const stats2 = statsMap[t2] || { TEAM: t2, SEED: 16, WAB: 0, "FT%": 70, "CONSISTENCY TR RATING": 10, EXP: 2, "BADJ EM": 0, "TR RANK": 150, BARTHAG: 0.5, LAST: 150, "AST%": 50 };

    const pred = predictMatchup(modelType, modelsData, t1Stats, stats2);

    // If stochastic: determine winner based on simulated coin flip using the predicted win probability.
    // Otherwise: deterministic (higher probability team wins).
    const isStochastic = Math.random() < chaosFactor;
    const team1Wins = isStochastic ? (Math.random() < pred.team1Prob) : (pred.team1Prob >= 0.5);
    const winner = team1Wins ? t1 : t2;

    results.push({
      TEAM1: t1,
      TEAM2: t2,
      WINNER: winner,
      TEAM1_PROB: pred.team1Prob,
      TEAM2_PROB: pred.team2Prob,
      SEED1: t1Stats.SEED,
      SEED2: stats2.SEED
    });

    winners.push(winner);
  });

  const nextMatchups = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      nextMatchups.push({
        TEAM1: winners[i],
        TEAM2: winners[i+1],
        MATCHUP_ID: i / 2
      });
    }
  }

  return { results, nextMatchups };
}

// Generates dynamic scouting reports based on stats differences
function generateScoutingReport(team1, team2) {
  if (!team1 || !team2) return [];
  const reports = [];

  // 1. Efficiency Margin (BADJ EM)
  const emDiff = team1["BADJ EM"] - team2["BADJ EM"];
  if (Math.abs(emDiff) >= 5.0) {
    const strongTeam = emDiff > 0 ? team1.TEAM : team2.TEAM;
    reports.push({
      type: 'efficiency',
      title: 'Per-Possession Efficiency',
      desc: `${strongTeam} holds a significant advantage in Adjusted Efficiency Margin (+${Math.abs(emDiff).toFixed(1)} EM), indicating a stronger overall offensive/defensive profile.`,
      isTeam1Advantage: emDiff > 0
    });
  } else {
    reports.push({
      type: 'efficiency',
      title: 'Per-Possession Efficiency',
      desc: `Very close efficiency metrics (margin of ${Math.abs(emDiff).toFixed(1)}). Expect a highly contested match with frequent lead changes.`,
      isNeutral: true
    });
  }

  // 2. Wins Above Bubble (WAB)
  const wabDiff = team1.WAB - team2.WAB;
  if (Math.abs(wabDiff) >= 3.0) {
    const strongTeam = wabDiff > 0 ? team1.TEAM : team2.TEAM;
    reports.push({
      type: 'wab',
      title: 'Resume & High-Pressure Performance',
      desc: `${strongTeam} has a superior Wins Above Bubble score (+${Math.abs(wabDiff).toFixed(1)} WAB), showing a stronger record against bubble-tier opponents.`,
      isTeam1Advantage: wabDiff > 0
    });
  }

  // 3. Free Throws (FT%)
  const ftDiff = team1["FT%"] - team2["FT%"];
  if (Math.abs(ftDiff) >= 4.0) {
    const strongTeam = ftDiff > 0 ? team1.TEAM : team2.TEAM;
    reports.push({
      type: 'clutch',
      title: 'Clutch Free-Throw Shooting',
      desc: `${strongTeam} is more reliable from the free-throw line (+${Math.abs(ftDiff).toFixed(1)}% FT%), which is a critical edge in late-game situations.`,
      isTeam1Advantage: ftDiff > 0
    });
  }

  // 4. Experience (EXP)
  const expDiff = team1.EXP - team2.EXP;
  if (Math.abs(expDiff) >= 0.4) {
    const olderTeam = expDiff > 0 ? team1.TEAM : team2.TEAM;
    reports.push({
      type: 'experience',
      title: 'Roster Experience & Maturity',
      desc: `${olderTeam} holds a clear edge in experience (+${Math.abs(expDiff).toFixed(2)} average years), providing stability under high-pressure tournament conditions.`,
      isTeam1Advantage: expDiff > 0
    });
  }

  // 5. Assist Percentage / Ball Movement (AST%)
  const astDiff = team1["AST%"] - team2["AST%"];
  if (Math.abs(astDiff) >= 6.0) {
    const strongTeam = astDiff > 0 ? team1.TEAM : team2.TEAM;
    reports.push({
      type: 'passing',
      title: 'Ball Movement & Chemistry',
      desc: `${strongTeam} has a substantially higher Assist rate (+${Math.abs(astDiff).toFixed(1)}%), highlighting superior offensive fluidity.`,
      isTeam1Advantage: astDiff > 0
    });
  }

  return reports;
}

// Radar Chart Helpers to normalize stats for radial coordinates
const normalizeStat = (feature, value) => {
  if (value === undefined || value === null) return 0.5;
  switch (feature) {
    case 'WAB':
      return Math.min(Math.max((value + 15) / 30, 0), 1);
    case 'BARTHAG':
      return Math.min(Math.max(value, 0), 1);
    case 'BADJ EM':
      return Math.min(Math.max((value + 20) / 60, 0), 1);
    case 'EXP':
      return Math.min(Math.max((value - 0.5) / 3.0, 0), 1);
    case 'FT%':
      return Math.min(Math.max((value - 40) / 55, 0), 1);
    default:
      return 0.5;
  }
};

const RADAR_FEATURES = [
  { key: 'WAB', label: 'Wins Above Bubble' },
  { key: 'BARTHAG', label: 'Barthag Power' },
  { key: 'BADJ EM', label: 'Efficiency Margin' },
  { key: 'EXP', label: 'Experience' },
  { key: 'FT%', label: 'Free Throw %' }
];

// Interactive SVG Radar Chart Component
function RadarChart({ team1, team2 }) {
  if (!team1 || !team2) return null;

  const cx = 150;
  const cy = 150;
  const r = 95;
  const numFeatures = RADAR_FEATURES.length;

  // Calculate vertices for grid levels (0.25, 0.5, 0.75, 1.0)
  const getGridPoints = (level) => {
    return RADAR_FEATURES.map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numFeatures;
      const x = cx + level * r * Math.cos(angle);
      const y = cy + level * r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  // Calculate polygon points for a team
  const getTeamPoints = (team) => {
    return RADAR_FEATURES.map((feat, i) => {
      const val = team[feat.key] !== undefined ? team[feat.key] : 0;
      const normVal = normalizeStat(feat.key, val);
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numFeatures;
      const x = cx + normVal * r * Math.cos(angle);
      const y = cy + normVal * r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  const team1Points = getTeamPoints(team1);
  const team2Points = getTeamPoints(team2);

  return (
    <div className="radar-chart-container">
      <svg viewBox="0 0 300 300" className="radar-chart-svg">
        {/* Background Grid Polygons */}
        {[0.25, 0.5, 0.75, 1.0].map((level, idx) => (
          <polygon
            key={`grid-${idx}`}
            points={getGridPoints(level)}
            className="radar-grid-line"
          />
        ))}

        {/* Axis Rays */}
        {RADAR_FEATURES.map((feat, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numFeatures;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              className="radar-axis-ray"
            />
          );
        })}

        {/* Team 1 Polygon (Blue Accent) */}
        <polygon
          points={team1Points}
          className="radar-poly-team1"
        />

        {/* Team 2 Polygon (Orange Accent) */}
        <polygon
          points={team2Points}
          className="radar-poly-team2"
        />

        {/* Outer Dot Vertices */}
        {RADAR_FEATURES.map((feat, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numFeatures;
          
          // Team 1 Dots
          const val1 = team1[feat.key] !== undefined ? team1[feat.key] : 0;
          const normVal1 = normalizeStat(feat.key, val1);
          const x1 = cx + normVal1 * r * Math.cos(angle);
          const y1 = cy + normVal1 * r * Math.sin(angle);

          // Team 2 Dots
          const val2 = team2[feat.key] !== undefined ? team2[feat.key] : 0;
          const normVal2 = normalizeStat(feat.key, val2);
          const x2 = cx + normVal2 * r * Math.cos(angle);
          const y2 = cy + normVal2 * r * Math.sin(angle);

          return (
            <g key={`dots-${i}`}>
              <circle cx={x1} cy={y1} r="4" className="radar-dot-team1" />
              <circle cx={x2} cy={y2} r="4" className="radar-dot-team2" />
            </g>
          );
        })}

        {/* Labels at pentagon corners */}
        {RADAR_FEATURES.map((feat, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numFeatures;
          const labelDist = r + 16;
          const x = cx + labelDist * Math.cos(angle);
          const y = cy + labelDist * Math.sin(angle);
          
          let textAnchor = 'middle';
          if (Math.cos(angle) > 0.1) textAnchor = 'start';
          else if (Math.cos(angle) < -0.1) textAnchor = 'end';

          let dy = '0.35em';
          if (angle === -Math.PI / 2) dy = '-0.5em';
          else if (angle > 0 && angle < Math.PI) dy = '0.9em';

          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dy={dy}
              className="radar-label"
            >
              {feat.key}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Helper to find the closest statistical matching team from history
function findClosestHistoricalComp(currentTeam, historicalList) {
  if (!currentTeam || !historicalList || historicalList.length === 0) return null;

  let bestComp = null;
  let highestSim = -1;

  const features = ['WAB', 'BARTHAG', 'BADJ EM', 'EXP', 'FT%', 'SEED'];
  const N = features.length;

  for (let i = 0; i < historicalList.length; i++) {
    const hist = historicalList[i];
    
    // Skip if it's the exact same team from the same year
    if (hist.TEAM === currentTeam.TEAM && hist.YEAR === currentTeam.YEAR) {
      continue;
    }

    let sumSqDiff = 0;
    for (let j = 0; j < N; j++) {
      const feat = features[j];
      const val1 = currentTeam[feat] !== undefined ? currentTeam[feat] : 0;
      const val2 = hist[feat] !== undefined ? hist[feat] : 0;

      let norm1, norm2;
      if (feat === 'SEED') {
        norm1 = (val1 - 1) / 15;
        norm2 = (val2 - 1) / 15;
      } else {
        norm1 = normalizeStat(feat, val1);
        norm2 = normalizeStat(feat, val2);
      }

      sumSqDiff += Math.pow(norm1 - norm2, 2);
    }

    const dist = Math.sqrt(sumSqDiff);
    const sim = 1 - (dist / Math.sqrt(N));
    const simPercentage = sim * 100;

    if (simPercentage > highestSim) {
      highestSim = simPercentage;
      bestComp = {
        team: hist.TEAM,
        year: hist.YEAR,
        similarity: simPercentage,
        stats: hist
      };
    }
  }

  return bestComp;
}

function App() {
  const [activeTab, setActiveTab] = useState('predictor'); // 'predictor' | 'bracket' | 'insights'
  const [modelType, setModelType] = useState('random_forest'); // 'random_forest' | 'decision_tree' | 'logistic_regression'

  // Global Team Stats State (initialized from 2025 dataset)
  const [globalStatsMap, setGlobalStatsMap] = useState({});

  // Predictor State
  const [selectedTeam1Key, setSelectedTeam1Key] = useState('');
  const [selectedTeam2Key, setSelectedTeam2Key] = useState('');
  const [team1Stats, setTeam1Stats] = useState(null);
  const [team2Stats, setTeam2Stats] = useState(null);
  const [allPredictions, setAllPredictions] = useState(null);

  const compTeam1 = React.useMemo(() => {
    return findClosestHistoricalComp(team1Stats, teamsHistorical);
  }, [team1Stats]);

  const compTeam2 = React.useMemo(() => {
    return findClosestHistoricalComp(team2Stats, teamsHistorical);
  }, [team2Stats]);

  // Bracket State
  const [bracketSimulated, setBracketSimulated] = useState(false);
  const [roundsResults, setRoundsResults] = useState({
    r64: [],
    r32: [],
    s16: [],
    e8: [],
    f4: [],
    champ: [],
    champion: ''
  });

  // Monte Carlo & Chaos Slider States
  const [chaosFactor, setChaosFactor] = useState(0.2); // 20% default chaos
  const [monteCarloResults, setMonteCarloResults] = useState(null);
  const [isSimulatingMC, setIsSimulatingMC] = useState(false);
  const [mcSearchQuery, setMcSearchQuery] = useState('');
  const [mcSortField, setMcSortField] = useState('winnerProb');
  const [mcSortAsc, setMcSortAsc] = useState(false);

  // Compute sorting/filtering for Monte Carlo table
  const sortedMcResults = React.useMemo(() => {
    if (!monteCarloResults) return [];
    
    // Filter
    const filtered = monteCarloResults.filter(team => 
      team.TEAM.toLowerCase().includes(mcSearchQuery.toLowerCase())
    );

    // Sort
    return [...filtered].sort((a, b) => {
      const valA = a[mcSortField];
      const valB = b[mcSortField];

      if (typeof valA === 'string') {
        return mcSortAsc 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return mcSortAsc 
          ? valA - valB 
          : valB - valA;
      }
    });
  }, [monteCarloResults, mcSearchQuery, mcSortField, mcSortAsc]);

  const topChamp = React.useMemo(() => {
    if (!monteCarloResults || monteCarloResults.length === 0) return null;
    return [...monteCarloResults].sort((a, b) => b.winnerProb - a.winnerProb)[0];
  }, [monteCarloResults]);

  const darkHorse = React.useMemo(() => {
    if (!monteCarloResults || monteCarloResults.length === 0) return null;
    const doubleDigit = monteCarloResults.filter(t => t.SEED >= 10);
    if (doubleDigit.length === 0) return null;
    return doubleDigit.sort((a, b) => b.s16Prob - a.s16Prob)[0];
  }, [monteCarloResults]);

  // Sidebar Stats Editor State
  const [editingTeamName, setEditingTeamName] = useState(null); // String name of team being edited
  const [editingStats, setEditingStats] = useState(null);

  // Insights State (Seed-based averages)
  const [seedAverages, setSeedAverages] = useState([]);

  // Compute seed averages dynamically on mount
  useEffect(() => {
    // Group historical teams by seed
    const seedGroups = {};
    for (let i = 1; i <= 16; i++) {
      seedGroups[i] = {
        SEED: i,
        count: 0,
        WAB: 0,
        "FT%": 0,
        "AST%": 0,
        BARTHAG: 0,
        "BADJ EM": 0,
        EXP: 0,
        "CONSISTENCY TR RATING": 0
      };
    }

    teamsHistorical.forEach(t => {
      const seed = parseInt(t.SEED);
      if (seed >= 1 && seed <= 16) {
        const g = seedGroups[seed];
        g.count += 1;
        g.WAB += t.WAB || 0;
        g["FT%"] += t["FT%"] || 0;
        g["AST%"] += t["AST%"] || 0;
        g.BARTHAG += t.BARTHAG || 0;
        g["BADJ EM"] += t["BADJ EM"] || 0;
        g.EXP += t.EXP || 0;
        g["CONSISTENCY TR RATING"] += t["CONSISTENCY TR RATING"] || 0;
      }
    });

    const calculatedAverages = Object.values(seedGroups).map(g => {
      const cnt = g.count || 1;
      return {
        SEED: g.SEED,
        WAB: g.WAB / cnt,
        "FT%": g["FT%"] / cnt,
        "AST%": g["AST%"] / cnt,
        BARTHAG: g.BARTHAG / cnt,
        "BADJ EM": g["BADJ EM"] / cnt,
        EXP: g.EXP / cnt,
        "CONSISTENCY TR RATING": g["CONSISTENCY TR RATING"] / cnt
      };
    });

    setSeedAverages(calculatedAverages);
  }, []);

  // Initial setup of stats map and default selector teams
  useEffect(() => {
    const statsMap = {};
    teams2025.forEach(t => {
      statsMap[t.TEAM] = { ...t };
    });
    setGlobalStatsMap(statsMap);

    // Default Team 1: Auburn (2025), Team 2: Alabama (2025)
    const defT1 = teams2025.find(t => t.TEAM === 'Auburn') || teams2025[0];
    const defT2 = teams2025.find(t => t.TEAM === 'Alabama') || teams2025[1];

    if (defT1) {
      setSelectedTeam1Key(`2025-${defT1.TEAM}`);
      setTeam1Stats({ ...defT1 });
    }
    if (defT2) {
      setSelectedTeam2Key(`2025-${defT2.TEAM}`);
      setTeam2Stats({ ...defT2 });
    }
  }, []);

  // Update predictions whenever stats or model changes in Predictor tab
  useEffect(() => {
    if (team1Stats && team2Stats) {
      const rf = predictMatchup('random_forest', modelsData, team1Stats, team2Stats);
      const dt = predictMatchup('decision_tree', modelsData, team1Stats, team2Stats);
      const lr = predictMatchup('logistic_regression', modelsData, team1Stats, team2Stats);

      const consensusProb1 = (rf.team1Prob + dt.team1Prob + lr.team1Prob) / 3;
      const consensusProb2 = (rf.team2Prob + dt.team2Prob + lr.team2Prob) / 3;

      setAllPredictions({
        random_forest: rf,
        decision_tree: dt,
        logistic_regression: lr,
        consensus: {
          winner: consensusProb1 >= 0.5 ? 1 : 2,
          team1Prob: consensusProb1,
          team2Prob: consensusProb2
        }
      });
    }
  }, [team1Stats, team2Stats, modelType]);

  // Combine 2025 and historical lists for selectors
  const historicalOptions = teamsHistorical.map(t => ({
    key: `hist-${t.YEAR}-${t.TEAM}`,
    label: `${t.TEAM} (${t.YEAR})`,
    stats: t
  }));

  const options2025 = teams2025.map(t => ({
    key: `2025-${t.TEAM}`,
    label: `${t.TEAM} (2025)`,
    stats: t
  }));

  // Handle dropdown selection change in Predictor
  const handleTeamChange = (teamNum, key) => {
    let selectedStats = null;
    if (key.startsWith('2025-')) {
      const teamName = key.replace('2025-', '');
      selectedStats = globalStatsMap[teamName] || teams2025.find(t => t.TEAM === teamName);
    } else {
      const match = key.match(/^hist-(\d+)-(.*)$/);
      if (match) {
        const year = parseInt(match[1]);
        const teamName = match[2];
        selectedStats = teamsHistorical.find(t => t.YEAR === year && t.TEAM === teamName);
      }
    }

    if (selectedStats) {
      if (teamNum === 1) {
        setSelectedTeam1Key(key);
        setTeam1Stats({ ...selectedStats });
      } else {
        setSelectedTeam2Key(key);
        setTeam2Stats({ ...selectedStats });
      }
    }
  };

  // Handle slider changes in Predictor
  const handleStatChange = (teamNum, feature, val) => {
    const numericVal = parseFloat(val);
    if (teamNum === 1) {
      setTeam1Stats(prev => ({ ...prev, [feature]: numericVal }));
      if (selectedTeam1Key.startsWith('2025-')) {
        const name = selectedTeam1Key.replace('2025-', '');
        setGlobalStatsMap(prev => ({
          ...prev,
          [name]: { ...prev[name], [feature]: numericVal }
        }));
      }
    } else {
      setTeam2Stats(prev => ({ ...prev, [feature]: numericVal }));
      if (selectedTeam2Key.startsWith('2025-')) {
        const name = selectedTeam2Key.replace('2025-', '');
        setGlobalStatsMap(prev => ({
          ...prev,
          [name]: { ...prev[name], [feature]: numericVal }
        }));
      }
    }
  };

  // Reset a team's stats to original values
  const resetStats = (teamNum) => {
    const key = teamNum === 1 ? selectedTeam1Key : selectedTeam2Key;
    let originalStats = null;
    if (key.startsWith('2025-')) {
      const teamName = key.replace('2025-', '');
      originalStats = teams2025.find(t => t.TEAM === teamName);
      if (originalStats) {
        setGlobalStatsMap(prev => ({
          ...prev,
          [teamName]: { ...originalStats }
        }));
      }
    } else {
      const match = key.match(/^hist-(\d+)-(.*)$/);
      if (match) {
        const year = parseInt(match[1]);
        const teamName = match[2];
        originalStats = teamsHistorical.find(t => t.YEAR === year && t.TEAM === teamName);
      }
    }

    if (originalStats) {
      if (teamNum === 1) {
        setTeam1Stats({ ...originalStats });
      } else {
        setTeam2Stats({ ...originalStats });
      }
    }
  };

  // Run full bracket simulation
  const runBracketSimulation = () => {
    const r64Sim = simulateRound(matchups2025, modelType, modelsData, globalStatsMap, chaosFactor);
    const r32Sim = simulateRound(r64Sim.nextMatchups, modelType, modelsData, globalStatsMap, chaosFactor);
    const s16Sim = simulateRound(r32Sim.nextMatchups, modelType, modelsData, globalStatsMap, chaosFactor);
    const e8Sim = simulateRound(s16Sim.nextMatchups, modelType, modelsData, globalStatsMap, chaosFactor);
    const f4Sim = simulateRound(e8Sim.nextMatchups, modelType, modelsData, globalStatsMap, chaosFactor);
    const champSim = simulateRound(f4Sim.nextMatchups, modelType, modelsData, globalStatsMap, chaosFactor);

    const champRes = champSim.results[0];
    const finalChampion = champRes ? champRes.WINNER : '';

    setRoundsResults({
      r64: r64Sim.results,
      r32: r32Sim.results,
      s16: s16Sim.results,
      e8: e8Sim.results,
      f4: f4Sim.results,
      champ: champSim.results,
      champion: finalChampion
    });
    setBracketSimulated(true);
  };

  // Run Monte Carlo simulation (1,000 runs) stochastically
  const runMonteCarloSimulation = (runs = 1000) => {
    setIsSimulatingMC(true);
    
    // Let loading screen draw
    setTimeout(() => {
      const stats = {};
      let totalUpsets = 0;

      // Initialize stats map for all 64 teams
      matchups2025.forEach(m => {
        const s1 = globalStatsMap[m.TEAM1]?.SEED || 16;
        const s2 = globalStatsMap[m.TEAM2]?.SEED || 16;
        stats[m.TEAM1] = { TEAM: m.TEAM1, SEED: s1, r32: 0, s16: 0, e8: 0, f4: 0, champ: 0, winner: 0 };
        stats[m.TEAM2] = { TEAM: m.TEAM2, SEED: s2, r32: 0, s16: 0, e8: 0, f4: 0, champ: 0, winner: 0 };
      });

      for (let r = 0; r < runs; r++) {
        let upsets = 0;

        // Run stochastically with chaosFactor = 1.0 (probabilistic outcomes) to compile correct odds
        const r64Sim = simulateRound(matchups2025, modelType, modelsData, globalStatsMap, 1.0);
        r64Sim.results.forEach(res => {
          stats[res.WINNER].r32 += 1;
          if (res.WINNER === res.TEAM1 && res.SEED1 > res.SEED2) upsets++;
          if (res.WINNER === res.TEAM2 && res.SEED2 > res.SEED1) upsets++;
        });

        const r32Sim = simulateRound(r64Sim.nextMatchups, modelType, modelsData, globalStatsMap, 1.0);
        r32Sim.results.forEach(res => {
          stats[res.WINNER].s16 += 1;
          const s1 = stats[res.TEAM1].SEED;
          const s2 = stats[res.TEAM2].SEED;
          if (res.WINNER === res.TEAM1 && s1 > s2) upsets++;
          if (res.WINNER === res.TEAM2 && s2 > s1) upsets++;
        });

        const s16Sim = simulateRound(r32Sim.nextMatchups, modelType, modelsData, globalStatsMap, 1.0);
        s16Sim.results.forEach(res => {
          stats[res.WINNER].e8 += 1;
          const s1 = stats[res.TEAM1].SEED;
          const s2 = stats[res.TEAM2].SEED;
          if (res.WINNER === res.TEAM1 && s1 > s2) upsets++;
          if (res.WINNER === res.TEAM2 && s2 > s1) upsets++;
        });

        const e8Sim = simulateRound(s16Sim.nextMatchups, modelType, modelsData, globalStatsMap, 1.0);
        e8Sim.results.forEach(res => {
          stats[res.WINNER].f4 += 1;
          const s1 = stats[res.TEAM1].SEED;
          const s2 = stats[res.TEAM2].SEED;
          if (res.WINNER === res.TEAM1 && s1 > s2) upsets++;
          if (res.WINNER === res.TEAM2 && s2 > s1) upsets++;
        });

        const f4Sim = simulateRound(e8Sim.nextMatchups, modelType, modelsData, globalStatsMap, 1.0);
        f4Sim.results.forEach(res => {
          stats[res.WINNER].champ += 1;
          const s1 = stats[res.TEAM1].SEED;
          const s2 = stats[res.TEAM2].SEED;
          if (res.WINNER === res.TEAM1 && s1 > s2) upsets++;
          if (res.WINNER === res.TEAM2 && s2 > s1) upsets++;
        });

        const champSim = simulateRound(f4Sim.nextMatchups, modelType, modelsData, globalStatsMap, 1.0);
        champSim.results.forEach(res => {
          stats[res.WINNER].winner += 1;
          const s1 = stats[res.TEAM1].SEED;
          const s2 = stats[res.TEAM2].SEED;
          if (res.WINNER === res.TEAM1 && s1 > s2) upsets++;
          if (res.WINNER === res.TEAM2 && s2 > s1) upsets++;
        });

        totalUpsets += upsets;
      }

      // Convert counts to percentages
      const resultsArray = Object.values(stats).map(item => ({
        ...item,
        r32Prob: item.r32 / runs,
        s16Prob: item.s16 / runs,
        e8Prob: item.e8 / runs,
        f4Prob: item.f4 / runs,
        champProb: item.champ / runs,
        winnerProb: item.winner / runs,
        // Save averages
        avgUpsets: totalUpsets / runs
      }));

      setMonteCarloResults(resultsArray);
      setIsSimulatingMC(false);
    }, 100);
  };

  // Open the sidebar editor for a clicked team in the bracket
  const openTeamEditor = (teamName) => {
    const stats = globalStatsMap[teamName];
    if (stats) {
      setEditingTeamName(teamName);
      setEditingStats({ ...stats });
    }
  };

  // Handle slider edits in the Sidebar
  const handleSidebarStatChange = (feature, val) => {
    const numericVal = parseFloat(val);
    setEditingStats(prev => ({ ...prev, [feature]: numericVal }));
  };

  // Save edits in the sidebar and re-run prediction/simulation
  const saveSidebarEdits = () => {
    setGlobalStatsMap(prev => ({
      ...prev,
      [editingTeamName]: { ...editingStats }
    }));

    if (team1Stats && team1Stats.TEAM === editingTeamName) {
      setTeam1Stats({ ...editingStats });
    }
    if (team2Stats && team2Stats.TEAM === editingTeamName) {
      setTeam2Stats({ ...editingStats });
    }

    setEditingTeamName(null);
    setEditingStats(null);

    if (bracketSimulated) {
      setTimeout(() => {
        runBracketSimulation();
      }, 50);
    }
  };

  // Reset a team's stats to original values via the sidebar
  const resetSidebarStats = () => {
    const originalStats = teams2025.find(t => t.TEAM === editingTeamName);
    if (originalStats) {
      setEditingStats({ ...originalStats });
    }
  };

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="app-header">
        <div className="brand-section">
          <Play className="brand-icon" />
          <div className="brand-title">
            <h1>March Madness Predictor</h1>
            <p>Interactive Machine Learning Outcome Simulator</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'predictor' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictor')}
          >
            <TrendingUp size={16} /> Predictor
          </button>
          <button 
            className={`tab-btn ${activeTab === 'bracket' ? 'active' : ''}`}
            onClick={() => setActiveTab('bracket')}
          >
            <Play size={16} /> Bracket Sim
          </button>
          <button 
            className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <BarChart2 size={16} /> Insights
          </button>
        </nav>
      </header>

      {/* Main Panel Content */}
      <main>
        {/* Tab 1: Matchup Predictor */}
        {activeTab === 'predictor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Top Selector Grid */}
            <div className="predictor-grid">
              
              {/* Team 1 Selector Panel */}
              <div className="glass-panel team-card team-1">
                <div className="team-header">
                  <div className="team-name-select">
                    <span className="winner-label" style={{ color: 'var(--color-secondary)' }}>Team 1 (Blue)</span>
                    <select 
                      className="form-select"
                      value={selectedTeam1Key}
                      onChange={(e) => handleTeamChange(1, e.target.value)}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <optgroup label="2025 Tournament Teams">
                        {options2025.map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Historical Tournament Teams">
                        {historicalOptions.map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  {team1Stats && (
                    <div className="team-seed-badge">
                      Seed {team1Stats.SEED}
                    </div>
                  )}
                </div>

                {/* Team 1 Sliders */}
                {team1Stats && (
                  <div className="sliders-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Adjust Team 1 Stats</h3>
                      <button className="close-btn" style={{ fontSize: '0.8rem', gap: '0.25rem' }} onClick={() => resetStats(1)}>
                        <RefreshCw size={12} /> Reset
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["WAB"]}>
                        <span>Wins Above Bubble (WAB)</span>
                        <span className="form-value">{team1Stats.WAB.toFixed(1)}</span>
                      </label>
                      <input 
                        type="range" min="-15" max="15" step="0.1"
                        className="custom-slider"
                        value={team1Stats.WAB}
                        onChange={(e) => handleStatChange(1, 'WAB', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["BARTHAG"]}>
                        <span>Barthag Power Rating</span>
                        <span className="form-value">{team1Stats.BARTHAG.toFixed(3)}</span>
                      </label>
                      <input 
                        type="range" min="0.0" max="1.0" step="0.001"
                        className="custom-slider"
                        value={team1Stats.BARTHAG}
                        onChange={(e) => handleStatChange(1, 'BARTHAG', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["BADJ EM"]}>
                        <span>Adjusted Efficiency Margin (BADJ EM)</span>
                        <span className="form-value">{team1Stats["BADJ EM"].toFixed(1)}</span>
                      </label>
                      <input 
                        type="range" min="-20" max="40" step="0.1"
                        className="custom-slider"
                        value={team1Stats["BADJ EM"]}
                        onChange={(e) => handleStatChange(1, 'BADJ EM', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["TR RANK"]}>
                        <span>Team Rankings Rank (TR RANK)</span>
                        <span className="form-value">{team1Stats["TR RANK"]}</span>
                      </label>
                      <input 
                        type="range" min="1" max="362" step="1"
                        className="custom-slider"
                        value={team1Stats["TR RANK"]}
                        onChange={(e) => handleStatChange(1, 'TR RANK', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["FT%"]}>
                        <span>Free Throw % (FT%)</span>
                        <span className="form-value">{team1Stats["FT%"].toFixed(1)}%</span>
                      </label>
                      <input 
                        type="range" min="40" max="95" step="0.1"
                        className="custom-slider"
                        value={team1Stats["FT%"]}
                        onChange={(e) => handleStatChange(1, 'FT%', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["AST%"]}>
                        <span>Assist % (AST%)</span>
                        <span className="form-value">{team1Stats["AST%"].toFixed(1)}%</span>
                      </label>
                      <input 
                        type="range" min="30" max="75" step="0.1"
                        className="custom-slider"
                        value={team1Stats["AST%"]}
                        onChange={(e) => handleStatChange(1, 'AST%', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["CONSISTENCY TR RATING"]}>
                        <span>Consistency Rating</span>
                        <span className="form-value">{team1Stats["CONSISTENCY TR RATING"].toFixed(1)}</span>
                      </label>
                      <input 
                        type="range" min="5.0" max="20.0" step="0.1"
                        className="custom-slider"
                        value={team1Stats["CONSISTENCY TR RATING"]}
                        onChange={(e) => handleStatChange(1, 'CONSISTENCY TR RATING', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["EXP"]}>
                        <span>Roster Experience (EXP)</span>
                        <span className="form-value">{team1Stats.EXP.toFixed(2)} yrs</span>
                      </label>
                      <input 
                        type="range" min="0.5" max="3.5" step="0.01"
                        className="custom-slider"
                        value={team1Stats.EXP}
                        onChange={(e) => handleStatChange(1, 'EXP', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["LAST"]}>
                        <span>Consistency Last Rank</span>
                        <span className="form-value">{team1Stats.LAST}</span>
                      </label>
                      <input 
                        type="range" min="1" max="362" step="1"
                        className="custom-slider"
                        value={team1Stats.LAST}
                        onChange={(e) => handleStatChange(1, 'LAST', e.target.value)}
                      />
                    </div>

                    {/* Historical Comp Display */}
                    {compTeam1 && (
                      <div className="similarity-comp-card">
                        <span className="similarity-label">Closest Historical Comp</span>
                        <div className="similarity-value-row">
                          <span className="similarity-team-name">{compTeam1.team} ({compTeam1.year})</span>
                          <span className="similarity-percentage">{compTeam1.similarity.toFixed(1)}% Match</span>
                        </div>
                        <div className="similarity-stats-grid">
                          <span>Seed: #{compTeam1.stats.SEED}</span>
                          <span>WAB: {compTeam1.stats.WAB.toFixed(1)}</span>
                          <span>Barthag: {compTeam1.stats.BARTHAG.toFixed(3)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Matchup Prediction Panel */}
              <div className="matchup-center">
                <div className="vs-badge">VS</div>

                <RadarChart team1={team1Stats} team2={team2Stats} />

                {allPredictions && allPredictions.consensus && team1Stats && team2Stats && (
                  <div className="winner-prediction-box consensus-box">
                    <span className="winner-label" style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.8rem' }}>Consensus Prediction</span>
                    <h2 className="winner-name" style={{ color: allPredictions.consensus.winner === 1 ? 'var(--color-secondary)' : 'var(--color-primary)' }}>
                      {allPredictions.consensus.winner === 1 ? team1Stats.TEAM : team2Stats.TEAM}
                    </h2>
                    <div className="winner-probability">
                      {allPredictions.consensus.winner === 1 
                        ? (allPredictions.consensus.team1Prob * 100).toFixed(1)
                        : (allPredictions.consensus.team2Prob * 100).toFixed(1)}%
                    </div>
                    <span className="winner-label" style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.15rem' }}>Consensus Win Probability</span>

                    {/* Probability Split Bar */}
                    <div className="prob-bar-container">
                      <div className="prob-bar-team1" style={{ width: `${allPredictions.consensus.team1Prob * 100}%` }}></div>
                      <div className="prob-bar-team2" style={{ width: `${allPredictions.consensus.team2Prob * 100}%` }}></div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      <span>{team1Stats.TEAM} ({(allPredictions.consensus.team1Prob * 100).toFixed(1)}%)</span>
                      <span>{team2Stats.TEAM} ({(allPredictions.consensus.team2Prob * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                )}

                {/* Model Predictions Comparison Grid */}
                {allPredictions && team1Stats && team2Stats && (
                  <div className="model-grid">
                    <div className={`model-mini-card ${allPredictions.random_forest.winner === 1 ? 'team1-pick' : 'team2-pick'}`}>
                      <span className="mini-card-title"><Cpu size={12} /> Random Forest</span>
                      <span className="mini-card-winner">
                        {allPredictions.random_forest.winner === 1 ? team1Stats.TEAM : team2Stats.TEAM}
                      </span>
                      <span className="mini-card-prob">
                        {allPredictions.random_forest.winner === 1 
                          ? (allPredictions.random_forest.team1Prob * 100).toFixed(0)
                          : (allPredictions.random_forest.team2Prob * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className={`model-mini-card ${allPredictions.logistic_regression.winner === 1 ? 'team1-pick' : 'team2-pick'}`}>
                      <span className="mini-card-title"><Cpu size={12} /> Logistic Reg.</span>
                      <span className="mini-card-winner">
                        {allPredictions.logistic_regression.winner === 1 ? team1Stats.TEAM : team2Stats.TEAM}
                      </span>
                      <span className="mini-card-prob">
                        {allPredictions.logistic_regression.winner === 1 
                          ? (allPredictions.logistic_regression.team1Prob * 100).toFixed(0)
                          : (allPredictions.logistic_regression.team2Prob * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className={`model-mini-card ${allPredictions.decision_tree.winner === 1 ? 'team1-pick' : 'team2-pick'}`}>
                      <span className="mini-card-title"><Cpu size={12} /> Decision Tree</span>
                      <span className="mini-card-winner">
                        {allPredictions.decision_tree.winner === 1 ? team1Stats.TEAM : team2Stats.TEAM}
                      </span>
                      <span className="mini-card-prob">
                        {allPredictions.decision_tree.winner === 1 
                          ? (allPredictions.decision_tree.team1Prob * 100).toFixed(0)
                          : (allPredictions.decision_tree.team2Prob * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Dynamic Scouting Report */}
                {team1Stats && team2Stats && (
                  <div className="scouting-report-box">
                    <h3 className="scouting-title"><BookOpen size={16} /> Matchup Scouting Report</h3>
                    <div className="scouting-list">
                      {generateScoutingReport(team1Stats, team2Stats).map((report, idx) => {
                        let IconComponent = Target;
                        if (report.type === 'efficiency') IconComponent = TrendingUp;
                        else if (report.type === 'wab') IconComponent = Award;
                        else if (report.type === 'experience') IconComponent = ShieldAlert;
                        else if (report.type === 'passing') IconComponent = CheckCircle;
                        return (
                          <div key={`report-${idx}`} className={`scouting-item ${report.isNeutral ? 'neutral' : (report.isTeam1Advantage ? 'team1-advantage' : 'team2-advantage')}`}>
                            <h4 className="scouting-item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <IconComponent size={14} />
                              {report.title}
                            </h4>
                            <p className="scouting-item-desc">{report.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Model Selector Toggle (Active simulation model) */}
                <div className="model-selector-panel">
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', paddingLeft: '0.25rem', fontWeight: '700' }}>Active Sim Model</h4>
                  
                  <div 
                    className={`model-radio ${modelType === 'random_forest' ? 'active' : ''}`}
                    onClick={() => setModelType('random_forest')}
                  >
                    <div className="model-radio-info">
                      <span className="model-radio-title">Random Forest</span>
                      <span className="model-radio-desc">Active bracket model (~70.8% Acc)</span>
                    </div>
                  </div>

                  <div 
                    className={`model-radio ${modelType === 'decision_tree' ? 'active' : ''}`}
                    onClick={() => setModelType('decision_tree')}
                  >
                    <div className="model-radio-info">
                      <span className="model-radio-title">Decision Tree</span>
                      <span className="model-radio-desc">Active bracket model (~59.4% Acc)</span>
                    </div>
                  </div>

                  <div 
                    className={`model-radio ${modelType === 'logistic_regression' ? 'active' : ''}`}
                    onClick={() => setModelType('logistic_regression')}
                  >
                    <div className="model-radio-info">
                      <span className="model-radio-title">Logistic Regression</span>
                      <span className="model-radio-desc">Active bracket model (~70.8% Acc)</span>
                    </div>
                  </div>
                </div>

                <div className="custom-alert">
                  <ShieldAlert className="custom-alert-icon" />
                  <div>
                    <div className="custom-alert-title">Experimental Mode</div>
                    Dragging sliders modifies team attributes dynamically. You can simulate cinderella runs or evaluate hypothetical matchups.
                  </div>
                </div>
              </div>

              {/* Team 2 Selector Panel */}
              <div className="glass-panel team-card team-2">
                <div className="team-header">
                  <div className="team-name-select">
                    <span className="winner-label" style={{ color: 'var(--color-primary)' }}>Team 2 (Orange)</span>
                    <select 
                      className="form-select"
                      value={selectedTeam2Key}
                      onChange={(e) => handleTeamChange(2, e.target.value)}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <optgroup label="2025 Tournament Teams">
                        {options2025.map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Historical Tournament Teams">
                        {historicalOptions.map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  {team2Stats && (
                    <div className="team-seed-badge">
                      Seed {team2Stats.SEED}
                    </div>
                  )}
                </div>

                {/* Team 2 Sliders */}
                {team2Stats && (
                  <div className="sliders-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Adjust Team 2 Stats</h3>
                      <button className="close-btn" style={{ fontSize: '0.8rem', gap: '0.25rem' }} onClick={() => resetStats(2)}>
                        <RefreshCw size={12} /> Reset
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["WAB"]}>
                        <span>Wins Above Bubble (WAB)</span>
                        <span className="form-value">{team2Stats.WAB.toFixed(1)}</span>
                      </label>
                      <input 
                        type="range" min="-15" max="15" step="0.1"
                        className="custom-slider"
                        value={team2Stats.WAB}
                        onChange={(e) => handleStatChange(2, 'WAB', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["BARTHAG"]}>
                        <span>Barthag Power Rating</span>
                        <span className="form-value">{team2Stats.BARTHAG.toFixed(3)}</span>
                      </label>
                      <input 
                        type="range" min="0.0" max="1.0" step="0.001"
                        className="custom-slider"
                        value={team2Stats.BARTHAG}
                        onChange={(e) => handleStatChange(2, 'BARTHAG', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["BADJ EM"]}>
                        <span>Adjusted Efficiency Margin (BADJ EM)</span>
                        <span className="form-value">{team2Stats["BADJ EM"].toFixed(1)}</span>
                      </label>
                      <input 
                        type="range" min="-20" max="40" step="0.1"
                        className="custom-slider"
                        value={team2Stats["BADJ EM"]}
                        onChange={(e) => handleStatChange(2, 'BADJ EM', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["TR RANK"]}>
                        <span>Team Rankings Rank (TR RANK)</span>
                        <span className="form-value">{team2Stats["TR RANK"]}</span>
                      </label>
                      <input 
                        type="range" min="1" max="362" step="1"
                        className="custom-slider"
                        value={team2Stats["TR RANK"]}
                        onChange={(e) => handleSidebarStatChange('TR RANK', e.target.value)} // fix event handler
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["FT%"]}>
                        <span>Free Throw % (FT%)</span>
                        <span className="form-value">{team2Stats["FT%"].toFixed(1)}%</span>
                      </label>
                      <input 
                        type="range" min="40" max="95" step="0.1"
                        className="custom-slider"
                        value={team2Stats["FT%"]}
                        onChange={(e) => handleStatChange(2, 'FT%', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["AST%"]}>
                        <span>Assist % (AST%)</span>
                        <span className="form-value">{team2Stats["AST%"].toFixed(1)}%</span>
                      </label>
                      <input 
                        type="range" min="30" max="75" step="0.1"
                        className="custom-slider"
                        value={team2Stats["AST%"]}
                        onChange={(e) => handleStatChange(2, 'AST%', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["CONSISTENCY TR RATING"]}>
                        <span>Consistency Rating</span>
                        <span className="form-value">{team2Stats["CONSISTENCY TR RATING"].toFixed(1)}</span>
                      </label>
                      <input 
                        type="range" min="5.0" max="20.0" step="0.1"
                        className="custom-slider"
                        value={team2Stats["CONSISTENCY TR RATING"]}
                        onChange={(e) => handleStatChange(2, 'CONSISTENCY TR RATING', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["EXP"]}>
                        <span>Roster Experience (EXP)</span>
                        <span className="form-value">{team2Stats.EXP.toFixed(2)} yrs</span>
                      </label>
                      <input 
                        type="range" min="0.5" max="3.5" step="0.01"
                        className="custom-slider"
                        value={team2Stats.EXP}
                        onChange={(e) => handleStatChange(2, 'EXP', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" title={featureDescriptions["LAST"]}>
                        <span>Consistency Last Rank</span>
                        <span className="form-value">{team2Stats.LAST}</span>
                      </label>
                      <input 
                        type="range" min="1" max="362" step="1"
                        className="custom-slider"
                        value={team2Stats.LAST}
                        onChange={(e) => handleStatChange(2, 'LAST', e.target.value)}
                      />
                    </div>

                    {/* Historical Comp Display */}
                    {compTeam2 && (
                      <div className="similarity-comp-card">
                        <span className="similarity-label">Closest Historical Comp</span>
                        <div className="similarity-value-row">
                          <span className="similarity-team-name">{compTeam2.team} ({compTeam2.year})</span>
                          <span className="similarity-percentage">{compTeam2.similarity.toFixed(1)}% Match</span>
                        </div>
                        <div className="similarity-stats-grid">
                          <span>Seed: #{compTeam2.stats.SEED}</span>
                          <span>WAB: {compTeam2.stats.WAB.toFixed(1)}</span>
                          <span>Barthag: {compTeam2.stats.BARTHAG.toFixed(3)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Bracket Simulator */}
        {activeTab === 'bracket' && (
          <div className="glass-panel" style={{ width: '100%' }}>
            
            {/* Controls */}
            <div className="bracket-controls">
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>2025 Bracket Simulator</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Simulate the 2025 tournament using the active <strong style={{ color: 'var(--color-primary)' }}>{modelType.replace('_', ' ')}</strong> model. Click any team name to adjust its stats!
                </p>
              </div>
              <button 
                className="sim-btn"
                onClick={runBracketSimulation}
              >
                <RefreshCw size={16} /> Run Single Simulation
              </button>
            </div>

            {/* Simulation Settings Grid */}
            <div className="simulation-settings-grid">
              <div className="glass-panel sim-config-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Madness / Upset Factor</h3>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-primary)' }}>{(chaosFactor * 100).toFixed(0)}% Chaos</span>
                </div>
                <input 
                  type="range" min="0.0" max="1.0" step="0.05"
                  className="custom-slider"
                  value={chaosFactor}
                  onChange={(e) => setChaosFactor(parseFloat(e.target.value))}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: '1.4' }}>
                  {chaosFactor === 0 
                    ? "Pure Analytical: The statistically stronger team always wins. No surprises."
                    : chaosFactor <= 0.3
                      ? "Realistic Odds: Models predict outcomes, but drawing probability-based upsets adds slight tournament realism."
                      : "March Madness Chaos: High random variance. Heavy odds are perturbed, enabling massive Cinderella runs."}
                </p>
              </div>

              <div className="glass-panel sim-config-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Monte Carlo Bracket Engine</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: '1.4' }}>
                    Simulate the tournament 1,000 times stochastically to generate round-by-round advancement probabilities for all 64 teams.
                  </p>
                </div>
                <button 
                  className="sim-btn" 
                  onClick={() => runMonteCarloSimulation(1000)}
                  disabled={isSimulatingMC}
                  style={{ marginTop: '0.75rem', width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  {isSimulatingMC ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" style={{ animation: 'spin 1s linear infinite' }} /> Simulating 1,000 Brackets...
                    </>
                  ) : (
                    <>
                      <BarChart2 size={16} /> Run Monte Carlo (1,000 Runs)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Champion Header */}
            {bracketSimulated && roundsResults.champion && (
              <div className="champion-reveal-card">
                <Award className="champion-trophy" />
                <span className="winner-label" style={{ letterSpacing: '0.2em' }}>Predicted Champion</span>
                <h2 style={{ fontSize: '2rem', color: '#FFF', fontFamily: 'var(--font-heading)', fontWeight: '800', marginTop: '0.5rem' }}>
                  {roundsResults.champion}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Click "Run Full Simulation" or tweak stats to see if a different champion emerges!
                </p>
              </div>
            )}

            {/* Interactive Bracket Columns */}
            <div className="bracket-simulator-container">
              <div className="bracket-rounds-wrapper">
                
                {/* Round of 64 */}
                <div className="round-column">
                  <div className="round-header-sticky">Round of 64</div>
                  {bracketSimulated && roundsResults.r64.map((m, i) => (
                    <div key={`r64-${i}`} className="bracket-matchup-node">
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM1 ? 'winner-pred-1' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM1)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED1}</span>{m.TEAM1}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM1 ? 'W' : 'L'}</span>
                      </div>
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM2 ? 'winner-pred-2' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM2)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED2}</span>{m.TEAM2}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM2 ? 'W' : 'L'}</span>
                      </div>
                      <div className="bracket-match-prob">
                        Prob: {(Math.max(m.TEAM1_PROB, m.TEAM2_PROB) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  {!bracketSimulated && matchups2025.map((m, i) => {
                    const s1 = globalStatsMap[m.TEAM1]?.SEED || 16;
                    const s2 = globalStatsMap[m.TEAM2]?.SEED || 16;
                    return (
                      <div key={`r64-init-${i}`} className="bracket-matchup-node">
                        <div className="bracket-team-row" onClick={() => openTeamEditor(m.TEAM1)}>
                          <span className="bracket-team-name"><span className="bracket-team-seed">{s1}</span>{m.TEAM1}</span>
                        </div>
                        <div className="bracket-team-row" onClick={() => openTeamEditor(m.TEAM2)}>
                          <span className="bracket-team-name"><span className="bracket-team-seed">{s2}</span>{m.TEAM2}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Round of 32 */}
                <div className="round-column">
                  <div className="round-header-sticky">Round of 32</div>
                  {bracketSimulated && roundsResults.r32.map((m, i) => (
                    <div key={`r32-${i}`} className="bracket-matchup-node">
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM1 ? 'winner-pred-1' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM1)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED1}</span>{m.TEAM1}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM1 ? 'W' : 'L'}</span>
                      </div>
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM2 ? 'winner-pred-2' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM2)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED2}</span>{m.TEAM2}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM2 ? 'W' : 'L'}</span>
                      </div>
                      <div className="bracket-match-prob">
                        Prob: {(Math.max(m.TEAM1_PROB, m.TEAM2_PROB) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  {!bracketSimulated && Array.from({ length: 16 }).map((_, i) => (
                    <div key={`r32-empty-${i}`} className="bracket-matchup-node" style={{ opacity: 0.25, borderStyle: 'dashed' }}>
                      <div className="bracket-team-row">TBD</div>
                      <div className="bracket-team-row">TBD</div>
                    </div>
                  ))}
                </div>

                {/* Sweet 16 */}
                <div className="round-column">
                  <div className="round-header-sticky">Sweet 16</div>
                  {bracketSimulated && roundsResults.s16.map((m, i) => (
                    <div key={`s16-${i}`} className="bracket-matchup-node">
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM1 ? 'winner-pred-1' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM1)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED1}</span>{m.TEAM1}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM1 ? 'W' : 'L'}</span>
                      </div>
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM2 ? 'winner-pred-2' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM2)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED2}</span>{m.TEAM2}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM2 ? 'W' : 'L'}</span>
                      </div>
                      <div className="bracket-match-prob">
                        Prob: {(Math.max(m.TEAM1_PROB, m.TEAM2_PROB) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  {!bracketSimulated && Array.from({ length: 8 }).map((_, i) => (
                    <div key={`s16-empty-${i}`} className="bracket-matchup-node" style={{ opacity: 0.25, borderStyle: 'dashed' }}>
                      <div className="bracket-team-row">TBD</div>
                      <div className="bracket-team-row">TBD</div>
                    </div>
                  ))}
                </div>

                {/* Elite 8 */}
                <div className="round-column">
                  <div className="round-header-sticky">Elite 8</div>
                  {bracketSimulated && roundsResults.e8.map((m, i) => (
                    <div key={`e8-${i}`} className="bracket-matchup-node">
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM1 ? 'winner-pred-1' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM1)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED1}</span>{m.TEAM1}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM1 ? 'W' : 'L'}</span>
                      </div>
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM2 ? 'winner-pred-2' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM2)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED2}</span>{m.TEAM2}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM2 ? 'W' : 'L'}</span>
                      </div>
                      <div className="bracket-match-prob">
                        Prob: {(Math.max(m.TEAM1_PROB, m.TEAM2_PROB) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  {!bracketSimulated && Array.from({ length: 4 }).map((_, i) => (
                    <div key={`e8-empty-${i}`} className="bracket-matchup-node" style={{ opacity: 0.25, borderStyle: 'dashed' }}>
                      <div className="bracket-team-row">TBD</div>
                      <div className="bracket-team-row">TBD</div>
                    </div>
                  ))}
                </div>

                {/* Final Four */}
                <div className="round-column">
                  <div className="round-header-sticky">Final Four</div>
                  {bracketSimulated && roundsResults.f4.map((m, i) => (
                    <div key={`f4-${i}`} className="bracket-matchup-node">
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM1 ? 'winner-pred-1' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM1)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED1}</span>{m.TEAM1}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM1 ? 'W' : 'L'}</span>
                      </div>
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM2 ? 'winner-pred-2' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM2)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED2}</span>{m.TEAM2}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM2 ? 'W' : 'L'}</span>
                      </div>
                      <div className="bracket-match-prob">
                        Prob: {(Math.max(m.TEAM1_PROB, m.TEAM2_PROB) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  {!bracketSimulated && Array.from({ length: 2 }).map((_, i) => (
                    <div key={`f4-empty-${i}`} className="bracket-matchup-node" style={{ opacity: 0.25, borderStyle: 'dashed' }}>
                      <div className="bracket-team-row">TBD</div>
                      <div className="bracket-team-row">TBD</div>
                    </div>
                  ))}
                </div>

                {/* Championship */}
                <div className="round-column">
                  <div className="round-header-sticky">Championship</div>
                  {bracketSimulated && roundsResults.champ.map((m, i) => (
                    <div key={`champ-${i}`} className="bracket-matchup-node">
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM1 ? 'winner-pred-1' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM1)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED1}</span>{m.TEAM1}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM1 ? 'W' : 'L'}</span>
                      </div>
                      <div 
                        className={`bracket-team-row ${m.WINNER === m.TEAM2 ? 'winner-pred-2' : ''}`}
                        onClick={() => openTeamEditor(m.TEAM2)}
                      >
                        <span className="bracket-team-name"><span className="bracket-team-seed">{m.SEED2}</span>{m.TEAM2}</span>
                        <span className="bracket-team-score">{m.WINNER === m.TEAM2 ? 'W' : 'L'}</span>
                      </div>
                      <div className="bracket-match-prob">
                        Prob: {(Math.max(m.TEAM1_PROB, m.TEAM2_PROB) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  {!bracketSimulated && (
                    <div className="bracket-matchup-node" style={{ opacity: 0.25, borderStyle: 'dashed' }}>
                      <div className="bracket-team-row">TBD</div>
                      <div className="bracket-team-row">TBD</div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Monte Carlo Results Dashboard & Table */}
            {monteCarloResults && (
              <>
                <div className="mc-dashboard-grid">
                  <div className="glass-panel mc-stat-card">
                    <span className="winner-label" style={{ fontSize: '0.7rem' }}>Projected National Champion</span>
                    <div className="mc-stat-value" style={{ color: 'var(--color-primary)' }}>
                      {topChamp ? `${topChamp.TEAM} (${(topChamp.winnerProb * 100).toFixed(1)}%)` : 'None'}
                    </div>
                    <span className="winner-label" style={{ fontSize: '0.65rem', textTransform: 'none', display: 'block', marginTop: '0.25rem' }}>
                      Won the simulated tournament the most times.
                    </span>
                  </div>
                  <div className="glass-panel mc-stat-card">
                    <span className="winner-label" style={{ fontSize: '0.7rem' }}>Cinderella of the Sim</span>
                    <div className="mc-stat-value" style={{ color: 'var(--color-secondary)' }}>
                      {darkHorse && darkHorse.s16Prob > 0 ? `${darkHorse.TEAM} (${(darkHorse.s16Prob * 100).toFixed(1)}% S16)` : 'None'}
                    </div>
                    <span className="winner-label" style={{ fontSize: '0.65rem', textTransform: 'none', display: 'block', marginTop: '0.25rem' }}>
                      Highest probability double-digit seed {"(seed >= 10)"} to make the Sweet 16.
                    </span>
                  </div>
                  <div className="glass-panel mc-stat-card">
                    <span className="winner-label" style={{ fontSize: '0.7rem' }}>Average Upsets per Run</span>
                    <div className="mc-stat-value" style={{ color: 'var(--color-success)' }}>
                      {monteCarloResults[0]?.avgUpsets.toFixed(1)} upsets
                    </div>
                    <span className="winner-label" style={{ fontSize: '0.65rem', textTransform: 'none', display: 'block', marginTop: '0.25rem' }}>
                      Standard historical tournament average is ~12.4 upsets.
                    </span>
                  </div>
                </div>

                <div className="glass-panel mc-table-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Advancement Probability Distribution</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                        Click any column header to sort teams. Hover or search to inspect details.
                      </p>
                    </div>
                    
                    <input
                      type="text"
                      className="form-select"
                      style={{ maxWidth: '280px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                      placeholder="🔍 Search teams..."
                      value={mcSearchQuery}
                      onChange={(e) => setMcSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="table-wrapper">
                    <table className="insights-table mc-table">
                      <thead>
                        <tr>
                          <th onClick={() => { setMcSortField('TEAM'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer' }}>
                            Team {mcSortField === 'TEAM' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                          <th onClick={() => { setMcSortField('SEED'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer', textAlign: 'center' }}>
                            Seed {mcSortField === 'SEED' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                          <th onClick={() => { setMcSortField('r32Prob'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer' }}>
                            R32 % {mcSortField === 'r32Prob' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                          <th onClick={() => { setMcSortField('s16Prob'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer' }}>
                            S16 % {mcSortField === 's16Prob' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                          <th onClick={() => { setMcSortField('e8Prob'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer' }}>
                            E8 % {mcSortField === 'e8Prob' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                          <th onClick={() => { setMcSortField('f4Prob'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer' }}>
                            F4 % {mcSortField === 'f4Prob' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                          <th onClick={() => { setMcSortField('champProb'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer' }}>
                            Champ % {mcSortField === 'champProb' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                          <th onClick={() => { setMcSortField('winnerProb'); setMcSortAsc(!mcSortAsc); }} style={{ cursor: 'pointer' }}>
                            Champion % {mcSortField === 'winnerProb' ? (mcSortAsc ? '▲' : '▼') : ''}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedMcResults.map(row => (
                          <tr key={`mc-row-${row.TEAM}`}>
                            <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{row.TEAM}</td>
                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)' }}>#{row.SEED}</td>
                            <td>
                              <div className="mc-bar-container">
                                <div className="mc-bar-fill" style={{ width: `${row.r32Prob * 100}%`, backgroundColor: 'var(--color-secondary)' }}></div>
                                <span className="mc-bar-text">{(row.r32Prob * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td>
                              <div className="mc-bar-container">
                                <div className="mc-bar-fill" style={{ width: `${row.s16Prob * 100}%`, backgroundColor: 'var(--color-secondary)' }}></div>
                                <span className="mc-bar-text">{(row.s16Prob * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td>
                              <div className="mc-bar-container">
                                <div className="mc-bar-fill" style={{ width: `${row.e8Prob * 100}%`, backgroundColor: 'var(--color-secondary)' }}></div>
                                <span className="mc-bar-text">{(row.e8Prob * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td>
                              <div className="mc-bar-container">
                                <div className="mc-bar-fill" style={{ width: `${row.f4Prob * 100}%`, backgroundColor: 'var(--color-primary)' }}></div>
                                <span className="mc-bar-text">{(row.f4Prob * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td>
                              <div className="mc-bar-container">
                                <div className="mc-bar-fill" style={{ width: `${row.champProb * 100}%`, backgroundColor: 'var(--color-primary)' }}></div>
                                <span className="mc-bar-text">{(row.champProb * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td>
                              <div className="mc-bar-container">
                                <div className="mc-bar-fill" style={{ width: `${row.winnerProb * 100}%`, backgroundColor: 'var(--color-success)' }}></div>
                                <span className="mc-bar-text" style={{ fontWeight: '800', color: 'var(--color-success)' }}>{(row.winnerProb * 100).toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {sortedMcResults.length === 0 && (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                              No matching teams found in simulation dataset.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Data Insights */}
        {activeTab === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="insights-grid">
              
              {/* Seed Performance Analysis Table */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Tournament Seeding & Stats Correlation</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Historical averages calculated dynamically across all tournament teams by seed.
                  </p>
                </div>

                <div className="table-wrapper">
                  <table className="insights-table">
                    <thead>
                      <tr>
                        <th>Seed</th>
                        <th>Avg WAB</th>
                        <th>Avg Barthag</th>
                        <th>Avg Adj EM</th>
                        <th>Avg FT%</th>
                        <th>Avg Assist%</th>
                        <th>Avg Exp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seedAverages.map(row => (
                        <tr key={`seed-avg-${row.SEED}`}>
                          <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>#{row.SEED}</td>
                          <td style={{ color: row.WAB >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {row.WAB >= 0 ? '+' : ''}{row.WAB.toFixed(1)}
                          </td>
                          <td>{row.BARTHAG.toFixed(3)}</td>
                          <td>{row.BARTHAG >= 0.5 ? '+' : ''}{row["BADJ EM"].toFixed(1)}</td>
                          <td>{row["FT%"].toFixed(1)}%</td>
                          <td>{row["AST%"].toFixed(1)}%</td>
                          <td>{row.EXP.toFixed(2)} yrs</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feature Importance panel */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Model Feature Importances</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Relative weight and impact of matchups variables on the Random Forest predictions.
                  </p>
                </div>

                <div className="importance-list">
                  {featureImportances.map((item, idx) => (
                    <div key={`feat-imp-${idx}`} className="importance-item">
                      <div className="importance-item-header">
                        <span style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>{item.label}</span>
                        <span style={{ color: 'var(--color-primary)', fontSize: '0.8rem', fontFamily: 'var(--font-heading)', fontWeight: '700' }}>
                          {(item.value * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="importance-bar-track">
                        <div className="importance-bar-fill" style={{ width: `${(item.value / 0.08) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Slide-out Sidebar for Bracket Editing */}
      <div className={`sidebar-panel ${editingTeamName ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
              {editingTeamName}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Edit team stats globally</span>
          </div>
          <button className="close-btn" onClick={() => { setEditingTeamName(null); setEditingStats(null); }}>
            <X size={20} />
          </button>
        </div>

        {editingStats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="team-seed-badge" style={{ borderColor: 'var(--color-primary)' }}>Seed {editingStats.SEED}</span>
              <button className="close-btn" style={{ fontSize: '0.8rem', gap: '0.25rem' }} onClick={resetSidebarStats}>
                <RefreshCw size={12} /> Reset Original
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["WAB"]}>
                <span>Wins Above Bubble (WAB)</span>
                <span className="form-value">{editingStats.WAB.toFixed(1)}</span>
              </label>
              <input 
                type="range" min="-15" max="15" step="0.1"
                className="custom-slider"
                value={editingStats.WAB}
                onChange={(e) => handleSidebarStatChange('WAB', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["BARTHAG"]}>
                <span>Barthag Power Rating</span>
                <span className="form-value">{editingStats.BARTHAG.toFixed(3)}</span>
              </label>
              <input 
                type="range" min="0.0" max="1.0" step="0.001"
                className="custom-slider"
                value={editingStats.BARTHAG}
                onChange={(e) => handleSidebarStatChange('BARTHAG', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["BADJ EM"]}>
                <span>Adjusted Efficiency Margin (BADJ EM)</span>
                <span className="form-value">{editingStats["BADJ EM"].toFixed(1)}</span>
              </label>
              <input 
                type="range" min="-20" max="40" step="0.1"
                className="custom-slider"
                value={editingStats["BADJ EM"]}
                onChange={(e) => handleSidebarStatChange('BADJ EM', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["TR RANK"]}>
                <span>Team Rankings Rank (TR RANK)</span>
                <span className="form-value">{editingStats["TR RANK"]}</span>
              </label>
              <input 
                type="range" min="1" max="362" step="1"
                className="custom-slider"
                value={editingStats["TR RANK"]}
                onChange={(e) => handleSidebarStatChange('TR RANK', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["FT%"]}>
                <span>Free Throw % (FT%)</span>
                <span className="form-value">{editingStats["FT%"].toFixed(1)}%</span>
              </label>
              <input 
                type="range" min="40" max="95" step="0.1"
                className="custom-slider"
                value={editingStats["FT%"]}
                onChange={(e) => handleSidebarStatChange('FT%', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["AST%"]}>
                <span>Assist % (AST%)</span>
                <span className="form-value">{editingStats["AST%"].toFixed(1)}%</span>
              </label>
              <input 
                type="range" min="30" max="75" step="0.1"
                className="custom-slider"
                value={editingStats["AST%"]}
                onChange={(e) => handleSidebarStatChange('AST%', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["CONSISTENCY TR RATING"]}>
                <span>Consistency Rating</span>
                <span className="form-value">{editingStats["CONSISTENCY TR RATING"].toFixed(1)}</span>
              </label>
              <input 
                type="range" min="5.0" max="20.0" step="0.1"
                className="custom-slider"
                value={editingStats["CONSISTENCY TR RATING"]}
                onChange={(e) => handleSidebarStatChange('CONSISTENCY TR RATING', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["EXP"]}>
                <span>Roster Experience (EXP)</span>
                <span className="form-value">{editingStats.EXP.toFixed(2)} yrs</span>
              </label>
              <input 
                type="range" min="0.5" max="3.5" step="0.01"
                className="custom-slider"
                value={editingStats.EXP}
                onChange={(e) => handleSidebarStatChange('EXP', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" title={featureDescriptions["LAST"]}>
                <span>Consistency Last Rank</span>
                <span className="form-value">{editingStats.LAST}</span>
              </label>
              <input 
                type="range" min="1" max="362" step="1"
                className="custom-slider"
                value={editingStats.LAST}
                onChange={(e) => handleSidebarStatChange('LAST', e.target.value)}
              />
            </div>

            <button 
              className="sim-btn"
              style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center' }}
              onClick={saveSidebarEdits}
            >
              <CheckCircle size={16} /> Save & Re-simulate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
