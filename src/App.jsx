import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, BarChart2, ShieldAlert, Settings, HelpCircle, RefreshCw, X, Award, CheckCircle } from 'lucide-react';
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

// Simulation Helper
function simulateRound(matchups, modelType, modelsData, statsMap) {
  const results = [];
  const winners = [];

  matchups.forEach((match, index) => {
    const t1 = match.TEAM1;
    const t2 = match.TEAM2;
    const t1Stats = statsMap[t1] || { TEAM: t1, SEED: 16, WAB: 0, "FT%": 70, "CONSISTENCY TR RATING": 10, EXP: 2, "BADJ EM": 0, "TR RANK": 150, BARTHAG: 0.5, LAST: 150, "AST%": 50 };
    const stats2 = statsMap[t2] || { TEAM: t2, SEED: 16, WAB: 0, "FT%": 70, "CONSISTENCY TR RATING": 10, EXP: 2, "BADJ EM": 0, "TR RANK": 150, BARTHAG: 0.5, LAST: 150, "AST%": 50 };

    const pred = predictMatchup(modelType, modelsData, t1Stats, stats2);

    results.push({
      TEAM1: t1,
      TEAM2: t2,
      WINNER: pred.winner === 1 ? t1 : t2,
      TEAM1_PROB: pred.team1Prob,
      TEAM2_PROB: pred.team2Prob,
      SEED1: t1Stats.SEED,
      SEED2: stats2.SEED
    });

    winners.push(pred.winner === 1 ? t1 : t2);
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
  const [prediction, setPrediction] = useState(null);

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

  // Sidebar Stats Editor State
  const [editingTeamName, setEditingTeamName] = useState(null); // String name of team being edited
  const [editingStats, setEditingStats] = useState(null);

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
      const res = predictMatchup(modelType, modelsData, team1Stats, team2Stats);
      setPrediction(res);
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
      // Use stats from globalStatsMap in case they were edited
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
      // Sync back to globalStatsMap if it's a 2025 team
      if (selectedTeam1Key.startsWith('2025-')) {
        const name = selectedTeam1Key.replace('2025-', '');
        setGlobalStatsMap(prev => ({
          ...prev,
          [name]: { ...prev[name], [feature]: numericVal }
        }));
      }
    } else {
      setTeam2Stats(prev => ({ ...prev, [feature]: numericVal }));
      // Sync back to globalStatsMap if it's a 2025 team
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
    // Round of 64
    const r64Sim = simulateRound(matchups2025, modelType, modelsData, globalStatsMap);
    
    // Round of 32
    const r32Sim = simulateRound(r64Sim.nextMatchups, modelType, modelsData, globalStatsMap);
    
    // Sweet 16
    const s16Sim = simulateRound(r32Sim.nextMatchups, modelType, modelsData, globalStatsMap);
    
    // Elite 8
    const e8Sim = simulateRound(s16Sim.nextMatchups, modelType, modelsData, globalStatsMap);
    
    // Final Four
    const f4Sim = simulateRound(e8Sim.nextMatchups, modelType, modelsData, globalStatsMap);
    
    // Championship
    const champSim = simulateRound(f4Sim.nextMatchups, modelType, modelsData, globalStatsMap);

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

    // If this team is currently active in the Predictor tab, sync it
    if (team1Stats && team1Stats.TEAM === editingTeamName) {
      setTeam1Stats({ ...editingStats });
    }
    if (team2Stats && team2Stats.TEAM === editingTeamName) {
      setTeam2Stats({ ...editingStats });
    }

    setEditingTeamName(null);
    setEditingStats(null);

    // Auto re-run simulation if it has already been run once
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
            disabled
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
            title="Coming soon in Step 9"
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
                  </div>
                )}
              </div>

              {/* Matchup Prediction Panel */}
              <div className="matchup-center">
                <div className="vs-badge">VS</div>

                {prediction && team1Stats && team2Stats && (
                  <div className="winner-prediction-box">
                    <span className="winner-label">Predicted Winner</span>
                    <h2 className="winner-name" style={{ color: prediction.winner === 1 ? 'var(--color-secondary)' : 'var(--color-primary)' }}>
                      {prediction.winner === 1 ? team1Stats.TEAM : team2Stats.TEAM}
                    </h2>
                    <div className="winner-probability">
                      {prediction.winner === 1 
                        ? (prediction.team1Prob * 100).toFixed(1)
                        : (prediction.team2Prob * 100).toFixed(1)}%
                    </div>
                    <span className="winner-label" style={{ fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>Win Probability</span>

                    {/* Probability Split Bar */}
                    <div className="prob-bar-container">
                      <div className="prob-bar-team1" style={{ width: `${prediction.team1Prob * 100}%` }}></div>
                      <div className="prob-bar-team2" style={{ width: `${prediction.team2Prob * 100}%` }}></div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      <span>{team1Stats.TEAM} ({(prediction.team1Prob * 100).toFixed(1)}%)</span>
                      <span>{team2Stats.TEAM} ({(prediction.team2Prob * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                )}

                {/* Model Toggle Radio Panel */}
                <div className="model-selector-panel">
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem', paddingLeft: '0.25rem' }}>Simulation Model</h4>
                  
                  <div 
                    className={`model-radio ${modelType === 'random_forest' ? 'active' : ''}`}
                    onClick={() => setModelType('random_forest')}
                  >
                    <div className="model-radio-info">
                      <span className="model-radio-title">Random Forest</span>
                      <span className="model-radio-desc">Ensemble of 100 trees (~70.8% Acc)</span>
                    </div>
                  </div>

                  <div 
                    className={`model-radio ${modelType === 'decision_tree' ? 'active' : ''}`}
                    onClick={() => setModelType('decision_tree')}
                  >
                    <div className="model-radio-info">
                      <span className="model-radio-title">Decision Tree</span>
                      <span className="model-radio-desc">Recursive splits model (~59.4% Acc)</span>
                    </div>
                  </div>

                  <div 
                    className={`model-radio ${modelType === 'logistic_regression' ? 'active' : ''}`}
                    onClick={() => setModelType('logistic_regression')}
                  >
                    <div className="model-radio-info">
                      <span className="model-radio-title">Logistic Regression</span>
                      <span className="model-radio-desc">Log-odds classification (~70.8% Acc)</span>
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
                        onChange={(e) => handleStatChange(2, 'TR RANK', e.target.value)}
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
                  Simulate the 2025 tournament using the <strong style={{ color: 'var(--color-primary)' }}>{modelType.replace('_', ' ')}</strong> model. Click any team name to adjust its stats!
                </p>
              </div>
              <button 
                className="sim-btn"
                onClick={runBracketSimulation}
              >
                <RefreshCw size={16} /> Run Full Simulation
              </button>
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
