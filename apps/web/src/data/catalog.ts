import type { ConfigField, NodeCategory, NodeIconKey, NodePort, NodeSpec } from '../types/workflow';

const input = (id: string, label: string, type: NodePort['type'], required = true): NodePort => ({
  id,
  label,
  type,
  required,
});

const output = (id: string, label: string, type: NodePort['type']): NodePort => ({ id, label, type });

const text = (key: string, label: string, defaultValue = '', description?: string): ConfigField => ({
  key,
  label,
  type: 'text',
  defaultValue,
  ...(description ? { description } : {}),
});

const number = (
  key: string,
  label: string,
  defaultValue: number,
  min?: number,
  max?: number,
  step?: number,
  advanced = false,
): ConfigField => ({
  key,
  label,
  type: 'number',
  defaultValue,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
  ...(step === undefined ? {} : { step }),
  ...(advanced ? { advanced } : {}),
});

const select = (
  key: string,
  label: string,
  defaultValue: string | number | boolean,
  options: NonNullable<ConfigField['options']>,
  description?: string,
  advanced = false,
): ConfigField => ({
  key,
  label,
  type: 'select',
  defaultValue,
  options,
  ...(description ? { description } : {}),
  ...(advanced ? { advanced } : {}),
});

const boolean = (key: string, label: string, defaultValue: boolean, description?: string): ConfigField => ({
  key,
  label,
  type: 'boolean',
  defaultValue,
  ...(description ? { description } : {}),
});

interface SpecInput {
  type: string;
  name: string;
  category: NodeCategory;
  icon: NodeIconKey;
  summary: string;
  learning: string;
  research: string;
  inputs?: NodePort[];
  outputs?: NodePort[];
  config?: ConfigField[];
  available?: boolean;
  keywords?: string[];
}

const define = (item: SpecInput): NodeSpec => ({
  type: item.type,
  version: 1,
  name: item.name,
  category: item.category,
  icon: item.icon,
  summary: item.summary,
  learningExplanation: item.learning,
  researchExplanation: item.research,
  inputs: item.inputs ?? [],
  outputs: item.outputs ?? [],
  configFields: item.config ?? [],
  available: item.available ?? false,
  keywords: item.keywords ?? [],
});

const dataSource = (
  type: string,
  name: string,
  summary: string,
  config: ConfigField[],
  keywords: string[] = [],
  available = false,
): NodeSpec =>
  define({
    type,
    name,
    category: 'Data sources',
    icon: 'database',
    summary,
    learning: 'Starts the workflow by bringing a table into the project. The original file is not changed.',
    research: 'Registers source metadata, a content fingerprint, schema evidence, and a reproducible local reference.',
    outputs: [output('dataset', 'Dataset', 'Dataset')],
    config,
    keywords,
    available,
  });

const inspect = (
  type: string,
  name: string,
  summary: string,
  keywords: string[] = [],
  available = false,
): NodeSpec =>
  define({
    type,
    name,
    category: 'Understand',
    icon: 'magnify',
    summary,
    learning: 'Examines the table without changing it, then explains what was found in plain language.',
    research: 'Produces a versioned diagnostic artifact while passing the source dataset through unchanged.',
    inputs: [input('dataset', 'Dataset', 'Dataset')],
    outputs: [output('dataset', 'Dataset', 'Dataset'), output('figures', 'Figures', 'FigureCollection')],
    keywords,
    available,
  });

const prepare = (type: string, name: string, summary: string, config: ConfigField[] = []): NodeSpec =>
  define({
    type,
    name,
    category: 'Prepare',
    icon: 'broom',
    summary,
    learning: 'Makes a visible, reversible change to the data. LibreML records exactly what changed.',
    research: 'Fits learned transformations on training data only when the node runs after a split.',
    inputs: [input('dataset', 'Dataset', 'Dataset')],
    outputs: [output('dataset', 'Dataset', 'Dataset')],
    config,
  });

const modelDefinition = (type: string, name: string, summary: string, config: ConfigField[]): NodeSpec =>
  define({
    type,
    name,
    category: 'Models',
    icon: 'brain',
    summary,
    learning: 'Defines how the model will learn patterns. It does not see the data until connected to Train model.',
    research: 'Creates a deterministic estimator specification with explicit hyperparameters and a recorded seed.',
    outputs: [output('model_definition', 'Model definition', 'ModelDefinition')],
    config,
    keywords: ['estimator', 'algorithm'],
  });

export const NODE_CATALOG: NodeSpec[] = [
  dataSource('csv_import', 'CSV import', 'Load a local comma-separated table.', [
    text('path', 'Local project path', 'bundled:community_learning_outcomes.csv'),
    text('delimiter', 'Delimiter', ','),
    text('encoding', 'Encoding', 'utf-8'),
    number('max_rows', 'Maximum rows', 100000, 1, 10_000_000, 1000, true),
  ], ['upload'], true),
  dataSource('excel_import', 'Excel import', 'Load a local Excel worksheet.', [text('file_name', 'File'), text('sheet_name', 'Sheet', 'Sheet1')], ['xlsx', 'spreadsheet']),
  dataSource('parquet_import', 'Parquet import', 'Load an efficient local columnar dataset.', [text('file_name', 'File')], ['columnar']),
  dataSource('google_sheet_import', 'Public Google Sheet', 'Import a published sheet after explicit approval.', [text('url', 'Published sheet URL')], ['network']),
  dataSource('rest_api_import', 'REST API import', 'Request a public JSON API with visible network settings.', [text('url', 'Request URL'), select('method', 'Method', 'GET', [{ label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }]), text('json_path', 'JSON extraction path', '$.data')], ['json', 'network']),
  dataSource('kaggle_import', 'Kaggle import', 'Use locally configured Kaggle credentials.', [text('dataset_slug', 'Dataset slug')], ['dataset hub']),

  define({
    type: 'dataset_overview',
    name: 'Dataset overview',
    category: 'Understand',
    icon: 'magnify',
    summary: 'Summarize shape, types, ranges, and sample values.',
    learning: 'Examines the table without changing it, then explains its rows, columns, missing values, and variable types.',
    research: 'Produces a fingerprint-linked descriptive artifact for the imported dataset.',
    inputs: [input('dataset', 'Dataset', 'Dataset')],
    outputs: [output('dataset', 'Dataset', 'Dataset'), output('overview', 'Dataset overview', 'DatasetOverview')],
    available: true,
  }),
  inspect('column_type_detection', 'Column type detection', 'Review inferred numeric, categorical, date, and text types.'),
  inspect('missing_value_analysis', 'Missing-value analysis', 'Measure missingness by row, column, and pattern.', ['null', 'na']),
  inspect('duplicate_detection', 'Duplicate detection', 'Find exact and likely duplicate records.'),
  inspect('distribution_analysis', 'Distribution analysis', 'Inspect numerical and categorical distributions.', ['histogram']),
  inspect('outlier_inspection', 'Outlier inspection', 'Flag unusual values without deleting them.'),
  inspect('correlation_analysis', 'Correlation analysis', 'Explore pairwise association and collinearity.'),
  inspect('class_balance_analysis', 'Class-balance analysis', 'Check whether outcome classes are represented unevenly.'),
  inspect('data_quality_report', 'Data-quality report', 'Combine integrity findings into a reviewable report.'),

  prepare('select_columns', 'Select columns', 'Keep or exclude named variables.', [text('columns', 'Columns', 'age, program, baseline_score, attendance_rate, completed')]),
  prepare('filter_rows', 'Filter rows', 'Keep rows matching a safe expression.', [text('expression', 'Filter expression')]),
  prepare('handle_missing_values', 'Handle missing values', 'Impute, flag, or remove missing observations.', [select('numeric_strategy', 'Numeric strategy', 'median', [{ label: 'Median', value: 'median' }, { label: 'Mean', value: 'mean' }, { label: 'Remove rows', value: 'drop' }])]),
  prepare('remove_duplicates', 'Remove duplicates', 'Remove reviewed duplicate records.'),
  prepare('convert_data_types', 'Convert data types', 'Apply explicit, validated type conversions.'),
  prepare('encode_categories', 'Encode categories', 'Convert category labels into model-ready values.', [select('strategy', 'Strategy', 'one_hot', [{ label: 'One-hot', value: 'one_hot' }, { label: 'Ordinal', value: 'ordinal' }])]),
  prepare('scale_numeric', 'Scale numeric variables', 'Place numeric features on a comparable scale.', [select('strategy', 'Strategy', 'standard', [{ label: 'Standard score', value: 'standard' }, { label: 'Robust scale', value: 'robust' }, { label: 'Min-max', value: 'minmax' }])]),
  prepare('handle_outliers', 'Handle outliers', 'Transform, cap, or exclude reviewed extreme values.'),
  prepare('derived_feature', 'Create derived feature', 'Build a feature with a restricted expression.', [text('name', 'New column'), text('expression', 'Safe expression')]),
  define({
    type: 'assign_roles',
    name: 'Assign feature and target roles',
    category: 'Prepare',
    icon: 'broom',
    summary: 'Choose predictors, outcome, identifiers, and unused columns.',
    learning: 'Tells the workflow what you want to predict and which information it may use.',
    research: 'Defines the analysis schema and excludes non-predictive identifiers before any split or fitting operation.',
    inputs: [input('dataset', 'Dataset', 'Dataset')],
    outputs: [output('labeled_dataset', 'Labeled dataset', 'LabeledDataset')],
    config: [
      select('task', 'Prediction task', 'classification', [
        { label: 'Classification', value: 'classification' },
        { label: 'Regression', value: 'regression' },
      ], 'Task type is explicit because it changes valid models, splitting, and evaluation metrics.'),
      text('target', 'Outcome variable', 'completed_program'),
      text('features', 'Predictor variables', 'age, hours_studied, attendance_rate, prior_score, program_type, outcome_proxy'),
      text('ignored', 'Ignored and identifier columns', 'participant_id'),
    ],
    available: true,
  }),

  define({
    type: 'train_test_split',
    name: 'Train/test split',
    category: 'Split',
    icon: 'split',
    summary: 'Reserve held-out rows for a final evaluation.',
    learning: 'Keeps some data hidden from the model so you can test how well it handles new cases.',
    research: 'Creates deterministic, disjoint partitions and records the split seed and strategy.',
    inputs: [input('labeled_dataset', 'Labeled dataset', 'LabeledDataset')],
    outputs: [output('split_dataset', 'Split dataset', 'SplitDataset')],
    config: [
      number('test_size', 'Test proportion', 0.2, 0.05, 0.5, 0.05),
      select('strategy', 'Split strategy', 'stratified', [
        { label: 'Stratified', value: 'stratified' },
        { label: 'Random', value: 'random' },
      ]),
      number('random_seed', 'Random seed', 17, 0, 2_147_483_647, 1),
    ],
    available: true,
  }),
  define({
    type: 'stratified_split',
    name: 'Stratified split',
    category: 'Split',
    icon: 'split',
    summary: 'Preserve outcome proportions across partitions.',
    learning: 'Keeps each outcome group similarly represented in training and test data.',
    research: 'Uses target-stratified sampling with deterministic allocation and minimum-stratum validation.',
    inputs: [input('role_assigned', 'Assigned dataset', 'RoleAssignedDataset')],
    outputs: [output('partitions', 'Dataset partitions', 'DatasetPartitions')],
    config: [number('test_size', 'Test proportion', 0.2, 0.05, 0.5, 0.05), number('random_seed', 'Random seed', 42, 0, 2_147_483_647, 1)],
  }),
  define({
    type: 'group_aware_split',
    name: 'Group-aware split',
    category: 'Split',
    icon: 'split',
    summary: 'Keep related observations in the same partition.',
    learning: 'Prevents records from the same person, site, or group appearing on both sides of the test.',
    research: 'Allocates complete groups to disjoint partitions to prevent dependence leakage.',
    inputs: [input('role_assigned', 'Assigned dataset', 'RoleAssignedDataset')],
    outputs: [output('partitions', 'Dataset partitions', 'DatasetPartitions')],
    config: [text('group_column', 'Group column')],
  }),
  define({
    type: 'kfold_cross_validation',
    name: 'K-fold cross-validation',
    category: 'Split',
    icon: 'split',
    summary: 'Evaluate across repeated held-out folds.',
    learning: 'Rotates which rows are hidden so performance is not based on one lucky split.',
    research: 'Defines a reproducible K-fold resampling plan with fold-level artifact retention.',
    inputs: [input('role_assigned', 'Assigned dataset', 'RoleAssignedDataset')],
    outputs: [output('partitions', 'Dataset partitions', 'DatasetPartitions')],
    config: [number('folds', 'Folds', 5, 2, 20, 1), number('random_seed', 'Random seed', 42, 0, 2_147_483_647, 1)],
  }),
  define({
    type: 'tabular_preprocess',
    name: 'Tabular preprocessing',
    category: 'Prepare',
    icon: 'broom',
    summary: 'Fit a leakage-safe numeric and categorical pipeline.',
    learning: 'Fills missing values, scales numbers, and encodes categories using training data only.',
    research: 'Fits partition-aware ColumnTransformer operations and serializes preprocessing with the estimator.',
    inputs: [input('split_dataset', 'Split dataset', 'SplitDataset')],
    outputs: [output('prepared_dataset', 'Prepared dataset', 'PreparedDataset')],
    config: [
      select('numeric_imputation', 'Numeric missing values', 'median', [{ label: 'Median', value: 'median' }, { label: 'Mean', value: 'mean' }]),
      select('categorical_imputation', 'Categorical missing values', 'most_frequent', [{ label: 'Most frequent', value: 'most_frequent' }]),
      boolean('scale_numeric', 'Scale numeric variables', true),
      number('max_categories_per_feature', 'Maximum categories per feature', 50, 2, 10_000, 1, true),
    ],
    available: true,
  }),

  define({
    type: 'model_definition',
    name: 'Model definition',
    category: 'Models',
    icon: 'brain',
    summary: 'Choose a supported estimator and explicit hyperparameters.',
    learning: 'Chooses the kind of pattern the model will try to learn. Start with a simple model you can explain.',
    research: 'Creates a versioned scikit-learn estimator specification with deterministic hyperparameters.',
    outputs: [output('model_definition', 'Model definition', 'ModelDefinition')],
    config: [
      select('task', 'Task', 'classification', [
        { label: 'Classification', value: 'classification' },
      ]),
      select('algorithm', 'Algorithm', 'logistic_regression', [
        { label: 'Logistic regression', value: 'logistic_regression' },
      ]),
      number('max_iter', 'Maximum iterations', 2000, 100, 10_000, 100),
    ],
    available: true,
  }),
  modelDefinition('ridge_regression', 'Ridge regression', 'Linear regression with coefficient shrinkage.', [number('alpha', 'Regularization strength', 1, 0, 1000, 0.1), number('random_seed', 'Random seed', 42, 0, 2_147_483_647, 1, true)]),
  modelDefinition('logistic_regression', 'Logistic regression', 'Interpretable classifier for categorical outcomes.', [number('regularization', 'Regularization strength', 1, 0.001, 100, 0.1), number('max_iterations', 'Maximum iterations', 1000, 100, 10_000, 100, true)]),
  modelDefinition('random_forest', 'Random forest', 'Ensemble of decision trees for nonlinear patterns.', [number('trees', 'Number of trees', 300, 10, 2000, 10), number('max_depth', 'Maximum depth', 8, 1, 100, 1), number('random_seed', 'Random seed', 42, 0, 2_147_483_647, 1, true)]),
  modelDefinition('gradient_boosting', 'Gradient boosting', 'Sequential tree ensemble for structured tabular data.', [number('estimators', 'Estimators', 150, 10, 2000, 10), number('learning_rate', 'Learning rate', 0.05, 0.001, 1, 0.01), number('random_seed', 'Random seed', 42, 0, 2_147_483_647, 1, true)]),
  define({
    type: 'train_model',
    name: 'Train model',
    category: 'Models',
    icon: 'brain',
    summary: 'Fit the selected model to the prepared training partition.',
    learning: 'Learns a pattern from the training rows while keeping test rows hidden.',
    research: 'Fits the preprocessing and estimator pipeline with recorded versions, seed, and resource timing.',
    inputs: [input('prepared_dataset', 'Prepared dataset', 'PreparedDataset'), input('model_definition', 'Model definition', 'ModelDefinition')],
    outputs: [output('trained_model', 'Trained model', 'TrainedModel')],
    config: [number('random_seed', 'Random seed', 17, 0, 2_147_483_647, 1)],
    available: true,
  }),

  define({
    type: 'evaluate_model',
    name: 'Evaluate model',
    category: 'Evaluate',
    icon: 'chart',
    summary: 'Compare held-out performance with a simple baseline.',
    learning: 'Measures mistakes on unseen rows and explains what each score can and cannot tell you.',
    research: 'Computes task-appropriate held-out metrics, baseline comparisons, residual diagnostics, and per-slice evidence.',
    inputs: [input('trained_model', 'Trained model', 'TrainedModel')],
    outputs: [output('metrics', 'Metrics', 'Metrics')],
    config: [text('positive_class', 'Positive class (optional)', '')],
    available: true,
  }),
  define({ type: 'cross_validation_summary', name: 'Cross-validation summary', category: 'Evaluate', icon: 'chart', summary: 'Summarize fold-level stability and uncertainty.', learning: 'Shows whether performance changes substantially across different subsets of the data.', research: 'Aggregates fold metrics with dispersion and confidence intervals.', inputs: [input('trained_model', 'Trained model', 'TrainedModel')], outputs: [output('metrics', 'Metrics', 'Metrics')] }),
  define({ type: 'model_comparison', name: 'Model comparison', category: 'Evaluate', icon: 'chart', summary: 'Compare candidate models on the same evaluation plan.', learning: 'Places models side by side using the same test so the comparison is fair.', research: 'Joins commensurate evaluation artifacts and guards against split or metric mismatch.', inputs: [input('metrics', 'Metrics', 'Metrics')], outputs: [output('metrics', 'Comparison', 'Metrics')] }),

  define({ type: 'feature_importance', name: 'Permutation importance', category: 'Interpret', icon: 'spark', summary: 'Measure predictive sensitivity to shuffled features.', learning: 'Checks how much model performance changes when one input is disrupted.', research: 'Computes held-out permutation importance with repeat-level dispersion. Predictive importance is not causal importance.', inputs: [input('trained_model', 'Trained model', 'TrainedModel')], outputs: [output('figures', 'Importance figures', 'FigureCollection')] }),
  define({ type: 'coefficient_interpretation', name: 'Coefficient interpretation', category: 'Interpret', icon: 'spark', summary: 'Explain linear-model direction and magnitude.', learning: 'Shows which inputs move predictions up or down when other inputs stay fixed.', research: 'Reports scale-aware coefficients, intervals where available, and collinearity cautions.', inputs: [input('trained_model', 'Trained model', 'TrainedModel')], outputs: [output('figures', 'Coefficient figures', 'FigureCollection')] }),
  define({ type: 'error_slice_analysis', name: 'Error slice analysis', category: 'Interpret', icon: 'spark', summary: 'Compare errors across reviewed subgroups.', learning: 'Looks for groups where the model makes larger mistakes.', research: 'Computes prespecified slice metrics with sample sizes and multiple-comparison cautions.', inputs: [input('trained_model', 'Trained model', 'TrainedModel')], outputs: [output('metrics', 'Slice metrics', 'Metrics')] }),

  define({ type: 'pearson_correlation', name: 'Pearson correlation', category: 'Statistics', icon: 'sigma', summary: 'Estimate linear association between two numeric variables.', learning: 'Measures whether two values tend to rise or fall together. It does not prove that one causes the other.', research: 'Reports r, confidence interval, p-value, assumptions, sample size, and multiplicity context.', inputs: [input('dataset', 'Dataset', 'Dataset')], outputs: [output('result', 'Statistical result', 'StatisticalResult')], config: [text('x', 'First variable'), text('y', 'Second variable')] }),
  define({ type: 'independent_t_test', name: 'Independent-samples t-test', category: 'Statistics', icon: 'sigma', summary: 'Compare means for two independent groups.', learning: 'Checks whether the average differs between two separate groups, while showing uncertainty.', research: 'Reports mean difference, confidence interval, effect size, test statistic, assumptions, and Welch correction.', inputs: [input('dataset', 'Dataset', 'Dataset')], outputs: [output('result', 'Statistical result', 'StatisticalResult')] }),
  define({ type: 'one_way_anova', name: 'One-way ANOVA', category: 'Statistics', icon: 'sigma', summary: 'Compare a numeric outcome across several groups.', learning: 'Checks whether at least one group average differs, then explains what follow-up comparisons are needed.', research: 'Reports omnibus inference, effect size, variance diagnostics, and multiplicity-aware follow-up guidance.', inputs: [input('dataset', 'Dataset', 'Dataset')], outputs: [output('result', 'Statistical result', 'StatisticalResult')] }),
  define({ type: 'chi_square_test', name: 'Chi-square test', category: 'Statistics', icon: 'sigma', summary: 'Test association between categorical variables.', learning: 'Checks whether two categories appear related more often than chance would suggest.', research: 'Reports contingency evidence, expected-count diagnostics, effect size, and sparse-cell warnings.', inputs: [input('dataset', 'Dataset', 'Dataset')], outputs: [output('result', 'Statistical result', 'StatisticalResult')] }),

  define({
    type: 'generate_report',
    name: 'Research report',
    category: 'Output',
    icon: 'file',
    summary: 'Generate deterministic methods, results, limitations, and provenance.',
    learning: 'Turns the recorded workflow into a clear report you can inspect and share.',
    research: 'Renders a versioned report from structured artifacts without inventing claims or causal language.',
    inputs: [input('metrics', 'Metrics', 'Metrics')],
    outputs: [output('report', 'Report', 'ReportArtifact')],
    config: [
      text('title', 'Report title', 'Community outcomes study'),
      text('research_question', 'Research question', 'Which baseline factors predict program completion?'),
      text('dataset_description', 'Dataset description', 'Bundled community learning outcomes dataset'),
      text('data_license', 'Data license', 'CC0-1.0'),
      text('limitations', 'Limitations', 'Observational sample; associations must not be interpreted as causal.'),
      text('project_url', 'Project URL', 'https://github.com/Samyrrrrrr990/libreml-studio'),
    ],
    available: true,
  }),
  define({ type: 'interactive_prediction', name: 'Interactive prediction', category: 'Output', icon: 'file', summary: 'Create a schema-validated local prediction form.', learning: 'Try new input values and see a prediction from the exact saved pipeline.', research: 'Runs the complete fitted preprocessing-estimator pipeline and records prediction provenance.', inputs: [input('trained_model', 'Trained model', 'TrainedModel')], outputs: [output('predictions', 'Predictions', 'Predictions')] }),
  define({ type: 'export_predictions', name: 'Export predictions', category: 'Output', icon: 'file', summary: 'Export row-matched predictions as a safe table.', learning: 'Saves predictions with identifiers so they can be matched back to source rows.', research: 'Escapes formula-like cells, records model and dataset fingerprints, and excludes secrets.', inputs: [input('predictions', 'Predictions', 'Predictions')], outputs: [output('report', 'Export artifact', 'ReportArtifact')] }),
];

export const NODE_BY_TYPE = new Map(NODE_CATALOG.map((spec) => [spec.type, spec]));

export const NODE_CATEGORIES: NodeCategory[] = [
  'Data sources',
  'Understand',
  'Prepare',
  'Split',
  'Models',
  'Evaluate',
  'Interpret',
  'Statistics',
  'Output',
];

export const defaultConfigForSpec = (spec: NodeSpec): Record<string, string | number | boolean> =>
  Object.fromEntries(spec.configFields.map((field) => [field.key, field.defaultValue]));
