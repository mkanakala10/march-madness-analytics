import pandas as pd
import numpy as np
import json
import urllib.request
import os

# 1. Paths
data_dir = "../Predicting-March-Madness-Outcomes/Predicting March Madness Outcomes/data"
model_dataset_path = f"{data_dir}/cleaned_model_dataset.csv"
matchups_path = f"{data_dir}/cleaned_matchups.csv"
dataset_2025_path = f"{data_dir}/cleaned_2025_dataset.csv"
matchups_2025_path = f"{data_dir}/cleaned_2025_matchups.csv"

# 2. Append 2025 results to training datasets
print("Appending 2025 results to training datasets...")
df_hist = pd.read_csv(model_dataset_path)
df_2025 = pd.read_csv(dataset_2025_path)

# Ensure 2025 teams aren't already in df_hist
if 2025 not in df_hist['YEAR'].unique():
    df_hist_new = pd.concat([df_hist, df_2025], ignore_index=True)
    df_hist_new.to_csv(model_dataset_path, index=False)
    print("Appended 2025 team statistics to cleaned_model_dataset.csv")
else:
    print("2025 team statistics already exist in cleaned_model_dataset.csv")

# Load matchups
matchups_hist = pd.read_csv(matchups_path)
matchups_2025 = pd.read_csv(matchups_2025_path)

# Map 2025 first round winners
winners_2025 = {
    0: "Auburn", 1: "Creighton", 2: "Michigan", 3: "Texas A&M",
    4: "Mississippi", 5: "Iowa St.", 6: "New Mexico", 7: "Michigan St.",
    8: "Florida", 9: "Connecticut", 10: "Colorado St.", 11: "Maryland",
    12: "Drake", 13: "Texas Tech", 14: "Arkansas", 15: "St. John's",
    16: "Duke", 17: "Baylor", 18: "Oregon", 19: "Arizona",
    20: "BYU", 21: "Wisconsin", 22: "Saint Mary's", 23: "Alabama",
    24: "Houston", 25: "Gonzaga", 26: "McNeese St.", 27: "Purdue",
    28: "Illinois", 29: "Kentucky", 30: "UCLA", 31: "Tennessee"
}

# Update matchups_2025 with actual winners
matchups_2025['WIN'] = matchups_2025.apply(
    lambda row: 1 if row['TEAM'] == winners_2025.get(row['MATCHUP_ID']) else 0, axis=1
)
matchups_2025['SCORE'] = 0.0 # dummy score

# Filter to round of 64
matchups_2025_r64 = matchups_2025[matchups_2025['CURRENT ROUND'] == 64]

if 2025 not in matchups_hist['YEAR'].unique():
    matchups_hist_new = pd.concat([matchups_hist, matchups_2025_r64], ignore_index=True)
    matchups_hist_new.to_csv(matchups_path, index=False)
    print("Appended 2025 tournament matchups to cleaned_matchups.csv")
else:
    print("2025 tournament matchups already exist in cleaned_matchups.csv")


# 3. Download/Load 2026 Barttorvik stats
print("Downloading 2026 Barttorvik statistics...")
url_2026 = "https://barttorvik.com/2026_team_results.csv"
csv_2026_path = "test_2026.csv"
if not os.path.exists(csv_2026_path):
    urllib.request.urlretrieve(url_2026, csv_2026_path)

df_2026 = pd.read_csv(csv_2026_path)

# Map official 2026 tournament teams and seeds
bracket_2026 = {
    # South
    "Florida": 1, "Prairie View A&M": 16, "Clemson": 8, "Iowa": 9,
    "Vanderbilt": 5, "McNeese St.": 12, "Nebraska": 4, "Troy": 13,
    "North Carolina": 6, "VCU": 11, "Illinois": 3, "Penn": 14,
    "Saint Mary's": 7, "Texas A&M": 10, "Houston": 2, "Idaho": 15,
    # West
    "Arizona": 1, "LIU": 16, "Villanova": 8, "Utah St.": 9,
    "Wisconsin": 5, "High Point": 12, "Arkansas": 4, "Hawaii": 13,
    "BYU": 6, "N.C. State": 11, "Gonzaga": 3, "Kennesaw St.": 14,
    "Miami FL": 7, "Missouri": 10, "Purdue": 2, "Queens": 15,
    # East
    "Duke": 1, "Siena": 16, "Ohio St.": 8, "TCU": 9,
    "St. John's": 5, "Northern Iowa": 12, "Kansas": 4, "Cal Baptist": 13,
    "Louisville": 6, "South Florida": 11, "Michigan St.": 3, "North Dakota St.": 14,
    "UCLA": 7, "UCF": 10, "Connecticut": 2, "Furman": 15,
    # Midwest
    "Michigan": 1, "Howard": 16, "Georgia": 8, "Saint Louis": 9,
    "Texas Tech": 5, "Akron": 12, "Alabama": 4, "Hofstra": 13,
    "Tennessee": 6, "SMU": 11, "Virginia": 3, "Wright St.": 14,
    "Kentucky": 7, "Santa Clara": 10, "Iowa St.": 2, "Tennessee St.": 15
}

# Load historical teams for averaging missing stats
with open("./teams_historical.json", "r") as f:
    teams_hist = json.load(f)

# Group historical statistics by team to compute averages
from collections import defaultdict
team_stats_history = defaultdict(list)
for t in teams_hist:
    team_stats_history[t['TEAM']].append(t)

# Average values across all historical tournament teams to use as defaults
all_ft = [t['FT%'] for t in teams_hist]
all_consistency = [t['CONSISTENCY TR RATING'] for t in teams_hist]
all_exp = [t.get('EXP', 1.5) for t in teams_hist]
all_last = [t.get('LAST', 150) for t in teams_hist]
all_ast = [t.get('AST%', 52.0) for t in teams_hist]

default_ft = sum(all_ft) / len(all_ft)
default_consistency = sum(all_consistency) / len(all_consistency)
default_exp = sum(all_exp) / len(all_exp)
default_last = sum(all_last) / len(all_last)
default_ast = sum(all_ast) / len(all_ast)

# Clean team name mapping
df_2026['clean_team'] = df_2026['team'].str.strip()

# Build 2026 teams list
teams_2026_list = []
missing_teams = []

for team_name, seed in bracket_2026.items():
    # Find team in 2026 results
    row = df_2026[df_2026['clean_team'] == team_name]
    if row.empty:
        # Fallback search
        row = df_2026[df_2026['clean_team'].str.contains(team_name, case=False)]
        if row.empty:
            missing_teams.append(team_name)
            continue
    
    row = row.iloc[0]
    
    # Base stats from 2026
    team_data = {
        "TEAM": team_name,
        "SEED": int(seed),
        "WAB": float(row['WAB']),
        "BARTHAG": float(row['barthag']),
        "BADJ EM": float(row['adjoe'] - row['adjde']),
        "TR RANK": int(row['rank'])
    }
    
    # Retrieve historical averages for other attributes
    hist_entries = team_stats_history.get(team_name, [])
    if hist_entries:
        team_data["FT%"] = sum(x['FT%'] for x in hist_entries) / len(hist_entries)
        team_data["CONSISTENCY TR RATING"] = sum(x['CONSISTENCY TR RATING'] for x in hist_entries) / len(hist_entries)
        team_data["EXP"] = sum(x.get('EXP', default_exp) for x in hist_entries) / len(hist_entries)
        team_data["LAST"] = int(sum(x.get('LAST', default_last) for x in hist_entries) / len(hist_entries))
        team_data["AST%"] = sum(x.get('AST%', default_ast) for x in hist_entries) / len(hist_entries)
    else:
        # Defaults
        team_data["FT%"] = default_ft
        team_data["CONSISTENCY TR RATING"] = default_consistency
        team_data["EXP"] = default_exp
        team_data["LAST"] = int(default_last)
        team_data["AST%"] = default_ast
        
    teams_2026_list.append(team_data)

print("Constructed 2026 tournament teams.")
if missing_teams:
    print("Warning: Missing teams from CSV:", missing_teams)

# Save to teams_2026.json
with open("./teams_2026.json", "w") as f:
    json.dump(teams_2026_list, f, indent=2)
print("Saved teams_2026.json")

# 4. Generate 2026 matchups
matchups_2026_list = [
    # South
    {"MATCHUP_ID": 0, "TEAM1": "Florida", "TEAM2": "Prairie View A&M"},
    {"MATCHUP_ID": 1, "TEAM1": "Clemson", "TEAM2": "Iowa"},
    {"MATCHUP_ID": 2, "TEAM1": "Vanderbilt", "TEAM2": "McNeese St."},
    {"MATCHUP_ID": 3, "TEAM1": "Nebraska", "TEAM2": "Troy"},
    {"MATCHUP_ID": 4, "TEAM1": "North Carolina", "TEAM2": "VCU"},
    {"MATCHUP_ID": 5, "TEAM1": "Illinois", "TEAM2": "Penn"},
    {"MATCHUP_ID": 6, "TEAM1": "Saint Mary's", "TEAM2": "Texas A&M"},
    {"MATCHUP_ID": 7, "TEAM1": "Houston", "TEAM2": "Idaho"},
    # West
    {"MATCHUP_ID": 8, "TEAM1": "Arizona", "TEAM2": "LIU"},
    {"MATCHUP_ID": 9, "TEAM1": "Villanova", "TEAM2": "Utah St."},
    {"MATCHUP_ID": 10, "TEAM1": "Wisconsin", "TEAM2": "High Point"},
    {"MATCHUP_ID": 11, "TEAM1": "Arkansas", "TEAM2": "Hawaii"},
    {"MATCHUP_ID": 12, "TEAM1": "BYU", "TEAM2": "N.C. State"},
    {"MATCHUP_ID": 13, "TEAM1": "Gonzaga", "TEAM2": "Kennesaw St."},
    {"MATCHUP_ID": 14, "TEAM1": "Miami FL", "TEAM2": "Missouri"},
    {"MATCHUP_ID": 15, "TEAM1": "Purdue", "TEAM2": "Queens"},
    # East
    {"MATCHUP_ID": 16, "TEAM1": "Duke", "TEAM2": "Siena"},
    {"MATCHUP_ID": 17, "TEAM1": "Ohio St.", "TEAM2": "TCU"},
    {"MATCHUP_ID": 18, "TEAM1": "St. John's", "TEAM2": "Northern Iowa"},
    {"MATCHUP_ID": 19, "TEAM1": "Kansas", "TEAM2": "Cal Baptist"},
    {"MATCHUP_ID": 20, "TEAM1": "Louisville", "TEAM2": "South Florida"},
    {"MATCHUP_ID": 21, "TEAM1": "Michigan St.", "TEAM2": "North Dakota St."},
    {"MATCHUP_ID": 22, "TEAM1": "UCLA", "TEAM2": "UCF"},
    {"MATCHUP_ID": 23, "TEAM1": "Connecticut", "TEAM2": "Furman"},
    # Midwest
    {"MATCHUP_ID": 24, "TEAM1": "Michigan", "TEAM2": "Howard"},
    {"MATCHUP_ID": 25, "TEAM1": "Georgia", "TEAM2": "Saint Louis"},
    {"MATCHUP_ID": 26, "TEAM1": "Texas Tech", "TEAM2": "Akron"},
    {"MATCHUP_ID": 27, "TEAM1": "Alabama", "TEAM2": "Hofstra"},
    {"MATCHUP_ID": 28, "TEAM1": "Tennessee", "TEAM2": "SMU"},
    {"MATCHUP_ID": 29, "TEAM1": "Virginia", "TEAM2": "Wright St."},
    {"MATCHUP_ID": 30, "TEAM1": "Kentucky", "TEAM2": "Santa Clara"},
    {"MATCHUP_ID": 31, "TEAM1": "Iowa St.", "TEAM2": "Tennessee St."},
]

with open("./matchups_2026.json", "w") as f:
    json.dump(matchups_2026_list, f, indent=2)
print("Saved matchups_2026.json")
