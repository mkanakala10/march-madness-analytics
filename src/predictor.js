/**
 * March Madness Prediction Engine
 * Evaluates Decision Tree, Random Forest, and Logistic Regression models
 * client-side using pre-trained weights.
 */

/**
 * Traverses a serialized Decision Tree node.
 * Returns [prob_team2_win, prob_team1_win].
 */
export function predictDecisionTree(node, inputs) {
  if (node.is_leaf) {
    return node.value; // Array of [prob_0, prob_1]
  }

  const val = inputs[node.feature];
  // If the feature is missing, default to 0 to prevent crashes
  const featureVal = val !== undefined && val !== null ? val : 0;

  if (featureVal <= node.threshold) {
    return predictDecisionTree(node.left, inputs);
  } else {
    return predictDecisionTree(node.right, inputs);
  }
}

/**
 * Evaluates the Random Forest model (average of 100 Decision Trees).
 * Returns [prob_team2_win, prob_team1_win].
 */
export function predictRandomForest(forest, inputs) {
  let sumProb0 = 0;
  let sumProb1 = 0;

  for (let i = 0; i < forest.length; i++) {
    const [p0, p1] = predictDecisionTree(forest[i], inputs);
    sumProb0 += p0;
    sumProb1 += p1;
  }

  const numTrees = forest.length;
  return [sumProb0 / numTrees, sumProb1 / numTrees];
}

/**
 * Evaluates the Logistic Regression model.
 * Returns [prob_team2_win, prob_team1_win].
 */
export function predictLogisticRegression(lr, inputs) {
  let z = lr.intercept;

  for (const feature in lr.coef) {
    if (Object.prototype.hasOwnProperty.call(lr.coef, feature)) {
      const val = inputs[feature];
      const featureVal = val !== undefined && val !== null ? val : 0;
      z += lr.coef[feature] * featureVal;
    }
  }

  // Sigmoid activation
  const prob1 = 1 / (1 + Math.exp(-z));
  return [1 - prob1, prob1];
}

/**
 * Combines inputs of Team 1 and Team 2 into the required 20-feature format:
 * [feature]_TEAM1 and [feature]_TEAM2
 */
export function formatMatchupInputs(team1Stats, team2Stats, featureNames) {
  const inputs = {};
  
  // Extract standard features for Team 1 and Team 2
  // Feature names in models.json are e.g. "SEED_TEAM1", "WAB_TEAM2"
  featureNames.forEach(featName => {
    if (featName.endsWith('_TEAM1')) {
      const baseFeat = featName.replace('_TEAM1', '');
      inputs[featName] = team1Stats[baseFeat] !== undefined ? team1Stats[baseFeat] : 0;
    } else if (featName.endsWith('_TEAM2')) {
      const baseFeat = featName.replace('_TEAM2', '');
      inputs[featName] = team2Stats[baseFeat] !== undefined ? team2Stats[baseFeat] : 0;
    }
  });

  return inputs;
}

/**
 * Predicts matchup outcomes using the selected model.
 * @param {string} modelType - 'random_forest' | 'decision_tree' | 'logistic_regression'
 * @param {object} modelsData - The loaded models.json file content
 * @param {object} team1Stats - Stats dictionary for Team 1
 * @param {object} team2Stats - Stats dictionary for Team 2
 * @returns {object} { winner: 1 | 2, team1Prob: number, team2Prob: number }
 */
export function predictMatchup(modelType, modelsData, team1Stats, team2Stats) {
  const inputs = formatMatchupInputs(team1Stats, team2Stats, modelsData.feature_names);
  let probs;

  if (modelType === 'random_forest') {
    probs = predictRandomForest(modelsData.random_forest, inputs);
  } else if (modelType === 'decision_tree') {
    probs = predictDecisionTree(modelsData.decision_tree, inputs);
  } else if (modelType === 'logistic_regression') {
    probs = predictLogisticRegression(modelsData.logistic_regression, inputs);
  } else {
    throw new Error(`Unknown model type: ${modelType}`);
  }

  const [prob2, prob1] = probs; // prob1 corresponds to TEAM1_WIN=1, prob2 to TEAM1_WIN=0 (TEAM2 wins)

  return {
    winner: prob1 >= 0.5 ? 1 : 2,
    team1Prob: prob1,
    team2Prob: prob2
  };
}
