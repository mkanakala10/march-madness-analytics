import pandas as pd
import numpy as np
import json
import random
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

# Set random seeds for reproducibility
random.seed(42)
np.random.seed(42)

# File paths
model_dataset_path = "./Predicting March Madness Outcomes/data/cleaned_model_dataset.csv"
matchups_path = "./Predicting March Madness Outcomes/data/cleaned_matchups.csv"
dataset_2025_path = "./Predicting March Madness Outcomes/data/cleaned_2025_dataset.csv"
matchups_2025_path = "./Predicting March Madness Outcomes/data/cleaned_2025_matchups.csv"

# Top features used in the notebook
top_features = [
    "WAB", "FT%", "CONSISTENCY TR RATING", "SEED", "EXP",
    "BADJ EM", "TR RANK", "BARTHAG", "LAST", "AST%"
]

# 1. Load data
df = pd.read_csv(model_dataset_path)
matchups = pd.read_csv(matchups_path)
df_2025 = pd.read_csv(dataset_2025_path)
matchups_2025_raw = pd.read_csv(matchups_2025_path)

# Strip whitespace from team names to prevent merge mismatches
df['TEAM'] = df['TEAM'].str.strip()
matchups['TEAM'] = matchups['TEAM'].str.strip()
df_2025['TEAM'] = df_2025['TEAM'].str.strip()
matchups_2025_raw['TEAM'] = matchups_2025_raw['TEAM'].str.strip()

# 2. Recreate historical combined matchups dataset
df_stats = df[['YEAR', 'TEAM', 'ROUND'] + top_features]
df_merged = matchups.merge(df_stats, how='left', on=['YEAR', 'TEAM'])

# Split into team 1 and 2 dataframes
team1_df = df_merged.loc[df_merged.groupby('MATCHUP_ID').head(1).index].copy()
team2_df = df_merged.loc[df_merged.groupby('MATCHUP_ID').tail(1).index].copy()

# Randomly swap team1 and team2 rows (reproducing notebook cell 8)
swap_mask = np.random.randint(0, 2, size=len(team1_df)).astype(bool)
team1_df_swapped = team1_df.copy()
team2_df_swapped = team2_df.copy()
team1_df.loc[swap_mask], team2_df.loc[swap_mask] = (
    team2_df_swapped.loc[swap_mask].values,
    team1_df_swapped.loc[swap_mask].values,
)

team1_df = team1_df.add_suffix('_TEAM1').rename(columns={'MATCHUP_ID_TEAM1': 'MATCHUP_ID'})
team2_df = team2_df.add_suffix('_TEAM2').rename(columns={'MATCHUP_ID_TEAM2': 'MATCHUP_ID'})
df_combined = pd.merge(team1_df, team2_df, on='MATCHUP_ID')

drop_cols = [
    'YEAR_TEAM1', 'TEAM_TEAM1', 'ROUND_TEAM1', 'SCORE_TEAM1',
    'YEAR_TEAM2', 'TEAM_TEAM2', 'ROUND_TEAM2', 'SCORE_TEAM2',
    'MATCHUP_ID', 'CURRENT ROUND_TEAM1', 'CURRENT ROUND_TEAM2', 'WIN_TEAM2'
]
df_cleaned = df_combined.drop(columns=drop_cols)
df_cleaned = df_cleaned.rename(columns={'WIN_TEAM1': 'TEAM1_WIN'})

# Train-Test Split (reproducing cell 9 and 10)
X = df_cleaned.drop('TEAM1_WIN', axis=1)
y = df_cleaned['TEAM1_WIN']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 3. Train models
# Decision Tree
dt_clf = DecisionTreeClassifier(random_state=42)
dt_clf.fit(X_train, y_train)
dt_acc = dt_clf.score(X_test, y_test)
print(f"Decision Tree Accuracy: {dt_acc:.4f}")

# Random Forest
rf_clf = RandomForestClassifier(n_estimators=100, max_depth=None, random_state=42)
rf_clf.fit(X_train, y_train)
rf_acc = rf_clf.score(X_test, y_test)
print(f"Random Forest Accuracy: {rf_acc:.4f}")

# Logistic Regression (Matchup Classifier)
lr_clf = LogisticRegression(random_state=42, max_iter=1000)
lr_clf.fit(X_train, y_train)
lr_acc = lr_clf.score(X_test, y_test)
print(f"Logistic Regression Accuracy: {lr_acc:.4f}")

# 4. Serialize Trees helper function
feature_names = list(X.columns)

def serialize_node(tree, node_id=0):
    if tree.children_left[node_id] == -1: # Leaf node
        # value contains counts for each class: value[node_id][0] = [count_class_0, count_class_1]
        counts = tree.value[node_id][0].tolist()
        total = sum(counts)
        probs = [c / total for c in counts] if total > 0 else [0.5, 0.5]
        return {
            "is_leaf": True,
            "value": probs
        }
    else: # Internal node
        return {
            "is_leaf": False,
            "feature": feature_names[tree.feature[node_id]],
            "threshold": float(tree.threshold[node_id]),
            "left": serialize_node(tree, tree.children_left[node_id]),
            "right": serialize_node(tree, tree.children_right[node_id])
        }

# Serialize the trained models to JSON format
models_data = {
    "feature_names": feature_names,
    "decision_tree": serialize_node(dt_clf.tree_),
    "random_forest": [serialize_node(estimator.tree_) for estimator in rf_clf.estimators_],
    "logistic_regression": {
        "coef": dict(zip(feature_names, lr_clf.coef_[0].tolist())),
        "intercept": float(lr_clf.intercept_[0])
    }
}

# 5. Export models to models.json
with open("./models.json", "w") as f:
    json.dump(models_data, f, indent=2)
print("Exported models.json")

# 6. Export 2025 team statistics
teams_2025 = []
for _, row in df_2025.iterrows():
    team_data = {"TEAM": row['TEAM']}
    for feat in top_features:
        # standardizing types
        val = row[feat]
        if feat in ["SEED", "TR RANK", "LAST"]:
            team_data[feat] = int(val)
        else:
            team_data[feat] = float(val)
    teams_2025.append(team_data)

with open("./teams_2025.json", "w") as f:
    json.dump(teams_2025, f, indent=2)
print("Exported teams_2025.json")

# 7. Export historical team statistics for search/comparison
teams_historical = []
for _, row in df.iterrows():
    team_data = {"YEAR": int(row['YEAR']), "TEAM": row['TEAM']}
    for feat in top_features:
        val = row[feat]
        if feat in ["SEED", "TR RANK", "LAST"]:
            team_data[feat] = int(val)
        else:
            team_data[feat] = float(val)
    teams_historical.append(team_data)

with open("./teams_historical.json", "w") as f:
    json.dump(teams_historical, f, indent=2)
print("Exported teams_historical.json")

# 8. Export 2025 matchups
matchups_2025_round64 = matchups_2025_raw[matchups_2025_raw['CURRENT ROUND'] == 64]
matchups_2025_grouped = matchups_2025_round64.groupby('MATCHUP_ID')
matchups_list = []

for matchup_id, group in matchups_2025_grouped:
    if len(group) == 2:
        teams = group['TEAM'].tolist()
        matchups_list.append({
            "MATCHUP_ID": int(matchup_id),
            "TEAM1": teams[0],
            "TEAM2": teams[1]
        })

with open("./matchups_2025.json", "w") as f:
    json.dump(matchups_list, f, indent=2)
print("Exported matchups_2025.json")
