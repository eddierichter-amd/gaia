class EvaluationVisualizer {
    constructor() {
        console.log('EvaluationVisualizer constructor called');
        this.loadedReports = new Map();
        this.initializeEventListeners();
        this.loadAvailableFiles();
    }

    initializeEventListeners() {
        const addBtn = document.getElementById('addReportBtn');
        const compareBtn = document.getElementById('compareBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        if (!addBtn || !compareBtn || !clearBtn) {
            console.error('One or more buttons not found in DOM');
            return;
        }
        
        console.log('Adding event listeners to buttons');
        addBtn.addEventListener('click', () => {
            console.log('Add Report button clicked');
            this.addSelectedReports();
        });
        compareBtn.addEventListener('click', () => {
            console.log('Compare button clicked');
            this.compareSelected();
        });
        clearBtn.addEventListener('click', () => {
            console.log('Clear button clicked');
            this.clearAllReports();
        });
    }

    async loadAvailableFiles() {
        try {
            console.log('Loading available files...');
            const [filesResponse, testDataResponse, groundtruthResponse] = await Promise.all([
                fetch('/api/files'),
                fetch('/api/test-data'),
                fetch('/api/groundtruth')
            ]);
            
            console.log('Responses received:', filesResponse.status, testDataResponse.status, groundtruthResponse.status);
            
            if (!filesResponse.ok) {
                throw new Error(`HTTP error! status: ${filesResponse.status}`);
            }
            
            const filesData = await filesResponse.json();
            const testData = testDataResponse.ok ? await testDataResponse.json() : { directories: [] };
            const groundtruthData = groundtruthResponse.ok ? await groundtruthResponse.json() : { files: [] };
            
            console.log('Data received:', { files: filesData, testData, groundtruthData });
            
            this.populateFileSelects({ ...filesData, testData, groundtruthData });
        } catch (error) {
            console.error('Failed to load available files:', error);
            this.showError('Failed to load available files');
        }
    }

    populateFileSelects(data) {
        console.log('Populating file selects with data:', data);
        const experimentSelect = document.getElementById('experimentSelect');
        const evaluationSelect = document.getElementById('evaluationSelect');
        const testDataSelect = document.getElementById('testDataSelect');
        const groundtruthSelect = document.getElementById('groundtruthSelect');

        if (!experimentSelect || !evaluationSelect || !testDataSelect || !groundtruthSelect) {
            console.error('Select elements not found in DOM');
            return;
        }

        // Clear existing options
        experimentSelect.innerHTML = '';
        evaluationSelect.innerHTML = '';
        testDataSelect.innerHTML = '';
        groundtruthSelect.innerHTML = '';

        // Populate experiments
        if (data.experiments.length === 0) {
            experimentSelect.innerHTML = '<option disabled>No experiment files found</option>';
        } else {
            console.log(`Adding ${data.experiments.length} experiment files`);
            data.experiments.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name.replace('.experiment.json', '');
                experimentSelect.appendChild(option);
            });
        }

        // Populate evaluations
        if (data.evaluations.length === 0) {
            evaluationSelect.innerHTML = '<option disabled>No evaluation files found</option>';
        } else {
            console.log(`Adding ${data.evaluations.length} evaluation files`);
            data.evaluations.forEach(file => {
                const option = document.createElement('option');
                option.value = file.name;
                option.textContent = file.name.replace('.experiment.eval.json', '');
                evaluationSelect.appendChild(option);
            });
        }

        // Populate test data
        if (!data.testData || data.testData.directories.length === 0) {
            testDataSelect.innerHTML = '<option disabled>No test data found</option>';
        } else {
            console.log(`Adding ${data.testData.directories.length} test data directories`);
            data.testData.directories.forEach(dir => {
                dir.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = `${dir.name}/${file}`;
                    option.textContent = `${dir.name}/${file.replace('.txt', '')}`;
                    testDataSelect.appendChild(option);
                });
            });
        }

        // Populate groundtruth
        if (!data.groundtruthData || data.groundtruthData.files.length === 0) {
            groundtruthSelect.innerHTML = '<option disabled>No groundtruth files found</option>';
        } else {
            console.log(`Adding ${data.groundtruthData.files.length} groundtruth files`);
            data.groundtruthData.files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.path;
                const displayName = file.name
                    .replace('.summarization.groundtruth.json', '')
                    .replace('.qa.groundtruth.json', '')
                    .replace('.groundtruth.json', '');
                option.textContent = file.directory === 'root' ? displayName : `${file.directory}/${displayName}`;
                if (file.type === 'consolidated') {
                    option.textContent += ' [Consolidated]';
                }
                groundtruthSelect.appendChild(option);
            });
        }
        console.log('File selects populated successfully');
        
        // Add double-click event listeners to enable direct file loading
        this.addDoubleClickHandlers();
    }

    async addSelectedReports() {
        console.log('addSelectedReports function called');
        
        const experimentSelect = document.getElementById('experimentSelect');
        const evaluationSelect = document.getElementById('evaluationSelect');
        const testDataSelect = document.getElementById('testDataSelect');
        const groundtruthSelect = document.getElementById('groundtruthSelect');

        if (!experimentSelect || !evaluationSelect || !testDataSelect || !groundtruthSelect) {
            console.error('Select elements not found');
            alert('Error: File selection elements not found');
            return;
        }

        const selectedExperiments = Array.from(experimentSelect.selectedOptions);
        const selectedEvaluations = Array.from(evaluationSelect.selectedOptions);
        const selectedTestData = Array.from(testDataSelect.selectedOptions);
        const selectedGroundtruth = Array.from(groundtruthSelect.selectedOptions);

        console.log('Selected experiments:', selectedExperiments.length);
        console.log('Selected evaluations:', selectedEvaluations.length);
        console.log('Selected test data:', selectedTestData.length);
        console.log('Selected groundtruth:', selectedGroundtruth.length);

        if (selectedExperiments.length === 0 && selectedEvaluations.length === 0 && 
            selectedTestData.length === 0 && selectedGroundtruth.length === 0) {
            alert('Please select at least one file to load');
            return;
        }

        // Load selected experiments
        for (const option of selectedExperiments) {
            await this.loadExperiment(option.value);
        }

        // Load selected evaluations
        for (const option of selectedEvaluations) {
            await this.loadEvaluation(option.value);
        }

        // Load selected test data
        for (const option of selectedTestData) {
            await this.loadTestData(option.value);
        }

        // Load selected groundtruth
        for (const option of selectedGroundtruth) {
            await this.loadGroundtruth(option.value);
        }

        // Clear selections
        experimentSelect.selectedIndex = -1;
        evaluationSelect.selectedIndex = -1;
        testDataSelect.selectedIndex = -1;
        groundtruthSelect.selectedIndex = -1;

        this.updateDisplay();
    }

    addDoubleClickHandlers() {
        const experimentSelect = document.getElementById('experimentSelect');
        const evaluationSelect = document.getElementById('evaluationSelect');
        const testDataSelect = document.getElementById('testDataSelect');
        const groundtruthSelect = document.getElementById('groundtruthSelect');

        if (experimentSelect) {
            experimentSelect.addEventListener('dblclick', (e) => {
                if (e.target.tagName === 'OPTION' && !e.target.disabled) {
                    this.addSingleReport('experiment', e.target.value);
                }
            });
        }

        if (evaluationSelect) {
            evaluationSelect.addEventListener('dblclick', (e) => {
                if (e.target.tagName === 'OPTION' && !e.target.disabled) {
                    this.addSingleReport('evaluation', e.target.value);
                }
            });
        }

        if (testDataSelect) {
            testDataSelect.addEventListener('dblclick', (e) => {
                if (e.target.tagName === 'OPTION' && !e.target.disabled) {
                    this.addSingleReport('testData', e.target.value);
                }
            });
        }

        if (groundtruthSelect) {
            groundtruthSelect.addEventListener('dblclick', (e) => {
                if (e.target.tagName === 'OPTION' && !e.target.disabled) {
                    this.addSingleReport('groundtruth', e.target.value);
                }
            });
        }

        console.log('Double-click handlers added to all select elements');
    }

    async addSingleReport(type, filename) {
        console.log(`Adding single ${type} report: ${filename}`);
        
        try {
            switch (type) {
                case 'experiment':
                    await this.loadExperiment(filename);
                    break;
                case 'evaluation':
                    await this.loadEvaluation(filename);
                    break;
                case 'testData':
                    await this.loadTestData(filename);
                    break;
                case 'groundtruth':
                    await this.loadGroundtruth(filename);
                    break;
                default:
                    console.error(`Unknown report type: ${type}`);
                    return;
            }
            
            this.updateDisplay();
            console.log(`Successfully added ${type} report: ${filename}`);
        } catch (error) {
            console.error(`Failed to add ${type} report:`, error);
            alert(`Failed to load ${type} report: ${filename}`);
        }
    }

    async loadExperiment(filename) {
        try {
            const response = await fetch(`/api/experiment/${filename}`);
            const data = await response.json();
            
            const reportId = filename.replace('.experiment.json', '');
            this.loadedReports.set(reportId, {
                ...this.loadedReports.get(reportId),
                experiment: data,
                filename: filename,
                type: 'experiment'
            });
        } catch (error) {
            console.error(`Failed to load experiment ${filename}:`, error);
            this.showError(`Failed to load experiment ${filename}`);
        }
    }

    async loadEvaluation(filename) {
        try {
            const response = await fetch(`/api/evaluation/${filename}`);
            const data = await response.json();
            
            const reportId = filename.replace('.experiment.eval.json', '');
            this.loadedReports.set(reportId, {
                ...this.loadedReports.get(reportId),
                evaluation: data,
                filename: filename,
                type: 'evaluation'
            });
        } catch (error) {
            console.error(`Failed to load evaluation ${filename}:`, error);
            this.showError(`Failed to load evaluation ${filename}`);
        }
    }

    async loadTestData(fileSpec) {
        try {
            const [type, filename] = fileSpec.split('/');
            const [contentResponse, metadataResponse] = await Promise.all([
                fetch(`/api/test-data/${type}/${filename}`),
                fetch(`/api/test-data/${type}/metadata`)
            ]);
            
            if (!contentResponse.ok) {
                throw new Error(`Failed to load test data: ${contentResponse.status}`);
            }
            
            const contentData = await contentResponse.json();
            const metadataData = metadataResponse.ok ? await metadataResponse.json() : null;
            
            const reportId = `testdata-${type}-${filename.replace('.txt', '')}`;
            this.loadedReports.set(reportId, {
                testData: {
                    content: contentData,
                    metadata: metadataData,
                    type: type,
                    filename: filename
                },
                filename: fileSpec,
                type: 'testdata'
            });
        } catch (error) {
            console.error(`Failed to load test data ${fileSpec}:`, error);
            this.showError(`Failed to load test data ${fileSpec}`);
        }
    }

    async loadGroundtruth(filename) {
        try {
            const response = await fetch(`/api/groundtruth/${filename}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load groundtruth: ${response.status}`);
            }
            
            const data = await response.json();
            
            const reportId = `groundtruth-${filename.replace(/\.(summarization|qa)\.groundtruth\.json$/, '').replace(/\//g, '-')}`;
            this.loadedReports.set(reportId, {
                groundtruth: data,
                filename: filename,
                type: 'groundtruth'
            });
        } catch (error) {
            console.error(`Failed to load groundtruth ${filename}:`, error);
            this.showError(`Failed to load groundtruth ${filename}`);
        }
    }

    updateDisplay() {
        const reportsGrid = document.getElementById('reportsGrid');
        
        if (this.loadedReports.size === 0) {
            reportsGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No reports loaded</h3>
                    <p>Select experiment, evaluation, test data, and/or groundtruth files to visualize results</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.loadedReports.forEach((report, reportId) => {
            html += this.generateReportCard(reportId, report);
        });

        reportsGrid.innerHTML = html;

        // Add event listeners for close buttons
        document.querySelectorAll('.report-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reportId = e.target.dataset.reportId;
                this.removeReport(reportId);
            });
        });

        // Add event listeners for collapsible sections
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const section = e.currentTarget.parentElement;
                const content = section.querySelector('.collapsible-content');
                const toggle = section.querySelector('.collapsible-toggle');
                
                if (content.classList.contains('expanded')) {
                    content.classList.remove('expanded');
                    toggle.classList.remove('expanded');
                    toggle.textContent = '▶';
                } else {
                    content.classList.add('expanded');
                    toggle.classList.add('expanded');
                    toggle.textContent = '▼';
                }
            });
        });
    }

    generateReportCard(reportId, report) {
        const hasExperiment = report.experiment !== undefined;
        const hasEvaluation = report.evaluation !== undefined;
        const hasTestData = report.testData !== undefined;
        const hasGroundtruth = report.groundtruth !== undefined;
        
        let title = reportId;
        let subtitle = '';
        
        if (hasGroundtruth) {
            const gtFile = report.filename;
            title = gtFile.replace(/\.(summarization|qa)\.groundtruth\.json$/, '').replace(/\//g, '/');
            subtitle = 'Groundtruth';
            if (gtFile.includes('consolidated')) {
                subtitle += ' [Consolidated]';
            }
        } else if (hasTestData) {
            title = `${report.testData.type}/${report.testData.filename.replace('.txt', '')}`;
            subtitle = 'Test Data';
        } else if (hasExperiment && hasEvaluation) {
            subtitle = 'Experiment + Evaluation';
        } else if (hasExperiment) {
            subtitle = 'Experiment Only';
        } else if (hasEvaluation) {
            subtitle = 'Evaluation Only';
        }

        return `
            <div class="report-card">
                <div class="report-header">
                    <h3>${title}</h3>
                    <div class="meta">${subtitle}</div>
                    <button class="report-close" data-report-id="${reportId}">×</button>
                </div>
                <div class="report-content">
                    ${hasGroundtruth ? this.generateGroundtruthSection(report.groundtruth) : 
                      hasTestData ? this.generateTestDataSection(report.testData) : this.generateMetricsSection(report)}
                    ${hasEvaluation ? this.generateEvaluationSummary(report.evaluation) : ''}
                    ${hasEvaluation ? this.generateQualitySection(report.evaluation) : ''}
                    ${hasExperiment ? this.generateExperimentDetails(report.experiment) : ''}
                    ${hasExperiment ? this.generateExperimentSummaries(report.experiment) : ''}
                    ${hasEvaluation ? this.generateEvaluationExplanations(report.evaluation) : ''}
                </div>
            </div>
        `;
    }

    generateMetricsSection(report) {
        const metrics = [];

        if (report.experiment) {
            const exp = report.experiment;
            metrics.push(
                { label: 'Total Cost', value: `$${exp.metadata.total_cost?.total_cost?.toFixed(4) || 'N/A'}` },
                { label: 'Total Tokens', value: exp.metadata.total_usage?.total_tokens?.toLocaleString() || 'N/A' },
                { label: 'Items', value: exp.metadata.total_items || 0 }
            );
        }

        if (report.evaluation) {
            const evalData = report.evaluation;
            const metrics_data = evalData.overall_rating?.metrics;
            if (metrics_data) {
                metrics.push(
                    { label: 'Quality Score', value: metrics_data.quality_score ? this.formatQualityScore(metrics_data.quality_score) : 'N/A' },
                    { label: 'Excellent', value: metrics_data.excellent_count || 0 },
                    { label: 'Good', value: metrics_data.good_count || 0 },
                    { label: 'Fair', value: metrics_data.fair_count || 0 },
                    { label: 'Poor', value: metrics_data.poor_count || 0 }
                );
            }
            
            // Add evaluation cost and usage metrics
            if (evalData.total_cost) {
                metrics.push(
                    { label: 'Eval Cost', value: `$${evalData.total_cost.total_cost?.toFixed(4) || 'N/A'}` }
                );
            }
            if (evalData.total_usage) {
                metrics.push(
                    { label: 'Eval Tokens', value: evalData.total_usage.total_tokens?.toLocaleString() || 'N/A' }
                );
            }
        }

        if (metrics.length === 0) {
            return '<p>No metrics available</p>';
        }

        return `
            <div class="metrics-grid">
                ${metrics.map(metric => `
                    <div class="metric-card">
                        <div class="metric-value">${metric.value}</div>
                        <div class="metric-label">${metric.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    formatQualityScore(score) {
        // Handle both old (1-4 scale) and new (0-100 percentage) formats
        let percentage;
        if (score <= 4) {
            // Old format: convert from 1-4 scale to percentage
            percentage = ((score - 1) / 3) * 100;
        } else {
            // New format: already a percentage
            percentage = score;
        }
        
        // Add qualitative label based on percentage ranges
        let label, cssClass;
        if (percentage >= 85) {
            label = 'Excellent';
            cssClass = 'quality-excellent';
        } else if (percentage >= 67) {
            label = 'Good';
            cssClass = 'quality-good';
        } else if (percentage >= 34) {
            label = 'Fair';
            cssClass = 'quality-fair';
        } else {
            label = 'Poor';
            cssClass = 'quality-poor';
        }
        
        return `${percentage.toFixed(1)}% <span class="${cssClass}">${label}</span>`;
    }

    generateEvaluationSummary(evaluation) {
        if (!evaluation) return '';

        const hasOverallAnalysis = evaluation.overall_analysis;
        const hasStrengths = evaluation.strengths && evaluation.strengths.length > 0;
        const hasWeaknesses = evaluation.weaknesses && evaluation.weaknesses.length > 0;
        const hasRecommendations = evaluation.recommendations && evaluation.recommendations.length > 0;
        const hasUseCaseFit = evaluation.use_case_fit;

        if (!hasOverallAnalysis && !hasStrengths && !hasWeaknesses && !hasRecommendations && !hasUseCaseFit) {
            return '';
        }

        return `
            <div class="evaluation-summary">
                <h4>Evaluation Summary</h4>
                ${hasOverallAnalysis ? `
                    <div class="summary-item">
                        <div class="summary-label">Overall Analysis</div>
                        <div class="summary-text">${this.escapeHtml(evaluation.overall_analysis)}</div>
                    </div>
                ` : ''}
                ${hasStrengths ? `
                    <div class="summary-item">
                        <div class="summary-label">Strengths</div>
                        <ul class="summary-list">
                            ${evaluation.strengths.map(strength => `<li>${this.escapeHtml(strength)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${hasWeaknesses ? `
                    <div class="summary-item">
                        <div class="summary-label">Weaknesses</div>
                        <ul class="summary-list">
                            ${evaluation.weaknesses.map(weakness => `<li>${this.escapeHtml(weakness)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${hasRecommendations ? `
                    <div class="summary-item">
                        <div class="summary-label">Recommendations</div>
                        <ul class="summary-list">
                            ${evaluation.recommendations.map(rec => `<li>${this.escapeHtml(rec)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${hasUseCaseFit ? `
                    <div class="summary-item">
                        <div class="summary-label">Use Case Fit</div>
                        <div class="summary-text">${this.escapeHtml(evaluation.use_case_fit)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    generateQualitySection(evaluation) {
        if (!evaluation.per_question || evaluation.per_question.length === 0) {
            return '';
        }

        // Take the first item's quality analysis as an example
        const firstItem = evaluation.per_question[0];
        const analysis = firstItem.analysis;

        if (!analysis) {
            return '';
        }

        const qualityItems = [
            { label: 'Executive Summary', rating: analysis.executive_summary_accuracy?.rating },
            { label: 'Completeness', rating: analysis.completeness?.rating },
            { label: 'Action Items', rating: analysis.action_items_accuracy?.rating },
            { label: 'Key Decisions', rating: analysis.key_decisions_accuracy?.rating },
            { label: 'Participant ID', rating: analysis.participant_identification?.rating },
            { label: 'Topic Coverage', rating: analysis.topic_coverage?.rating }
        ].filter(item => item.rating);

        if (qualityItems.length === 0) {
            return '';
        }

        return `
            <div class="quality-section">
                <h4>Quality Analysis (Sample)</h4>
                ${qualityItems.map(item => `
                    <div class="quality-item">
                        <span class="quality-label">${item.label}</span>
                        <span class="quality-rating rating-${item.rating}">${item.rating}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    generateExperimentDetails(experiment) {
        const metadata = experiment.metadata;
        
        return `
            <div class="experiment-details">
                <h4>Experiment Details</h4>
                <div class="detail-grid">
                    <div><strong>Model:</strong> ${metadata.model || 'N/A'}</div>
                    <div><strong>Temperature:</strong> ${metadata.temperature || 'N/A'}</div>
                    <div><strong>Max Tokens:</strong> ${metadata.max_tokens || 'N/A'}</div>
                    <div><strong>Date:</strong> ${metadata.timestamp || 'N/A'}</div>
                    ${metadata.errors && metadata.errors.length > 0 ? 
                        `<div style="color: #dc3545;"><strong>Errors:</strong> ${metadata.errors.length}</div>` : 
                        ''}
                </div>
            </div>
        `;
    }

    generateExperimentSummaries(experiment) {
        if (!experiment.analysis || !experiment.analysis.summarization_results) {
            return '';
        }

        const results = experiment.analysis.summarization_results;
        if (results.length === 0) {
            return '';
        }

        // Generate content for all summarization results
        let summariesHtml = '';
        results.forEach((result, index) => {
            if (result.generated_summaries) {
                const summaries = result.generated_summaries;
                const sourceFile = result.source_file ? result.source_file.split('\\').pop().split('/').pop() : `Item ${index + 1}`;
                
                summariesHtml += `
                    <div class="collapsible-section" data-section="summaries-${index}">
                        <div class="collapsible-header">
                            <h4>Generated Summaries - ${sourceFile}</h4>
                            <span class="collapsible-toggle">▶</span>
                        </div>
                        <div class="collapsible-content">
                            <div class="collapsible-body">
                                ${Object.entries(summaries).map(([key, value]) => `
                                    <div class="summary-item">
                                        <div class="summary-label">${key.replace(/_/g, ' ').toUpperCase()}</div>
                                        <div class="summary-text">${this.escapeHtml(value)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        return summariesHtml;
    }

    generateEvaluationExplanations(evaluation) {
        if (!evaluation.per_question || evaluation.per_question.length === 0) {
            return '';
        }

        let explanationsHtml = '';
        evaluation.per_question.forEach((item, index) => {
            if (item.analysis) {
                const analysis = item.analysis;
                const sourceFile = item.source_file ? item.source_file.split('\\').pop().split('/').pop() : `Item ${index + 1}`;
                
                const explanationItems = [
                    { key: 'executive_summary_accuracy', label: 'Executive Summary Accuracy' },
                    { key: 'completeness', label: 'Completeness' },
                    { key: 'action_items_accuracy', label: 'Action Items Accuracy' },
                    { key: 'key_decisions_accuracy', label: 'Key Decisions Accuracy' },
                    { key: 'participant_identification', label: 'Participant Identification' },
                    { key: 'topic_coverage', label: 'Topic Coverage' }
                ].filter(item => analysis[item.key] && analysis[item.key].explanation);

                if (explanationItems.length > 0) {
                    explanationsHtml += `
                        <div class="collapsible-section" data-section="explanations-${index}">
                            <div class="collapsible-header">
                                <h4>Quality Explanations - ${sourceFile}</h4>
                                <span class="collapsible-toggle">▶</span>
                            </div>
                            <div class="collapsible-content">
                                <div class="collapsible-body">
                                    ${explanationItems.map(item => {
                                        const data = analysis[item.key];
                                        return `
                                            <div class="explanation-item">
                                                <div class="explanation-label">${item.label}</div>
                                                <div class="explanation-rating">
                                                    <span class="quality-rating rating-${data.rating}">${data.rating}</span>
                                                </div>
                                                <div class="explanation-text">${this.escapeHtml(data.explanation)}</div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
        });

        return explanationsHtml;
    }

    generateTestDataSection(testData) {
        const { content, metadata, type, filename } = testData;
        
        let metadataInfo = '';
        if (metadata) {
            const info = metadata.generation_info || {};
            const fileInfo = metadata[type === 'emails' ? 'emails' : 'transcripts']?.find(
                item => item.filename === filename
            );
            
            metadataInfo = `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${type}</div>
                        <div class="metric-label">Type</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${fileInfo?.estimated_tokens || 'N/A'}</div>
                        <div class="metric-label">Est. Tokens</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">$${fileInfo?.claude_cost?.total_cost?.toFixed(4) || 'N/A'}</div>
                        <div class="metric-label">Generation Cost</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${info.claude_model || 'N/A'}</div>
                        <div class="metric-label">Model</div>
                    </div>
                </div>
            `;
        }
        
        return `
            ${metadataInfo}
            <div class="collapsible-section">
                <div class="collapsible-header">
                    <h4>Content</h4>
                    <span class="collapsible-toggle">▶</span>
                </div>
                <div class="collapsible-content">
                    <div class="collapsible-body">
                        <div class="summary-item">
                            <div class="summary-label">${filename}</div>
                            <div class="summary-text">${this.escapeHtml(content.content)}</div>
                        </div>
                    </div>
                </div>
            </div>
            ${metadata ? this.generateTestDataMetadataSection(metadata, type) : ''}
        `;
    }

    generateTestDataMetadataSection(metadata, type) {
        const info = metadata.generation_info || {};
        const items = metadata[type === 'emails' ? 'emails' : 'transcripts'] || [];
        
        return `
            <div class="collapsible-section">
                <div class="collapsible-header">
                    <h4>Generation Metadata</h4>
                    <span class="collapsible-toggle">▶</span>
                </div>
                <div class="collapsible-content">
                    <div class="collapsible-body">
                        <div class="detail-grid">
                            <div><strong>Generated:</strong> ${new Date(info.generated_date).toLocaleString()}</div>
                            <div><strong>Total Files:</strong> ${info.total_files}</div>
                            <div><strong>Target Tokens:</strong> ${info.target_tokens_per_file}</div>
                            <div><strong>Total Cost:</strong> $${info.total_claude_cost?.total_cost?.toFixed(4) || 'N/A'}</div>
                            <div><strong>Total Tokens:</strong> ${info.total_claude_usage?.total_tokens || 'N/A'}</div>
                            <div><strong>Model:</strong> ${info.claude_model}</div>
                        </div>
                        ${items.length > 0 ? `
                            <h5 style="margin-top: 15px;">All ${type === 'emails' ? 'Emails' : 'Transcripts'}</h5>
                            <div class="detail-grid">
                                ${items.map(item => `
                                    <div style="grid-column: 1 / -1; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                                        <strong>${item.filename}</strong><br>
                                        <small>${item.description}</small><br>
                                        <small>Tokens: ${item.estimated_tokens}, Cost: $${item.claude_cost?.total_cost?.toFixed(4) || 'N/A'}</small>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    generateGroundtruthSection(groundtruth) {
        const { metadata, analysis } = groundtruth;
        
        let metadataInfo = '';
        if (metadata) {
            metadataInfo = `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${metadata.use_case || 'N/A'}</div>
                        <div class="metric-label">Use Case</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${metadata.usage?.total_tokens || 'N/A'}</div>
                        <div class="metric-label">Total Tokens</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">$${metadata.cost?.total_cost?.toFixed(4) || 'N/A'}</div>
                        <div class="metric-label">Generation Cost</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${metadata.model || 'N/A'}</div>
                        <div class="metric-label">Model</div>
                    </div>
                </div>
            `;
        }
        
        return `
            ${metadataInfo}
            ${analysis?.summaries ? this.generateGroundtruthSummaries(analysis.summaries) : ''}
            ${analysis?.evaluation_criteria ? this.generateGroundtruthCriteria(analysis.evaluation_criteria) : ''}
            ${metadata ? this.generateGroundtruthMetadataSection(metadata, analysis) : ''}
        `;
    }

    generateGroundtruthSummaries(summaries) {
        return `
            <div class="collapsible-section">
                <div class="collapsible-header">
                    <h4>Ground Truth Summaries</h4>
                    <span class="collapsible-toggle">▶</span>
                </div>
                <div class="collapsible-content">
                    <div class="collapsible-body">
                        ${Object.entries(summaries).map(([key, value]) => {
                            if (Array.isArray(value)) {
                                return `
                                    <div class="summary-item">
                                        <div class="summary-label">${key.replace(/_/g, ' ').toUpperCase()}</div>
                                        <div class="summary-text">${value.map(item => `• ${this.escapeHtml(item)}`).join('\n')}</div>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="summary-item">
                                        <div class="summary-label">${key.replace(/_/g, ' ').toUpperCase()}</div>
                                        <div class="summary-text">${this.escapeHtml(value)}</div>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    generateGroundtruthCriteria(criteria) {
        return `
            <div class="collapsible-section">
                <div class="collapsible-header">
                    <h4>Evaluation Criteria</h4>
                    <span class="collapsible-toggle">▶</span>
                </div>
                <div class="collapsible-content">
                    <div class="collapsible-body">
                        ${Object.entries(criteria).map(([key, value]) => `
                            <div class="summary-item">
                                <div class="summary-label">${key.replace(/_/g, ' ').toUpperCase()}</div>
                                <div class="summary-text">${this.escapeHtml(value)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    generateGroundtruthMetadataSection(metadata, analysis) {
        return `
            <div class="collapsible-section">
                <div class="collapsible-header">
                    <h4>Generation Details</h4>
                    <span class="collapsible-toggle">▶</span>
                </div>
                <div class="collapsible-content">
                    <div class="collapsible-body">
                        <div class="detail-grid">
                            <div><strong>Generated:</strong> ${metadata.timestamp}</div>
                            <div><strong>Source File:</strong> ${metadata.source_file}</div>
                            <div><strong>Model:</strong> ${metadata.model}</div>
                            <div><strong>Use Case:</strong> ${metadata.use_case}</div>
                            <div><strong>Input Tokens:</strong> ${metadata.usage?.input_tokens || 'N/A'}</div>
                            <div><strong>Output Tokens:</strong> ${metadata.usage?.output_tokens || 'N/A'}</div>
                            <div><strong>Input Cost:</strong> $${metadata.cost?.input_cost?.toFixed(4) || 'N/A'}</div>
                            <div><strong>Output Cost:</strong> $${metadata.cost?.output_cost?.toFixed(4) || 'N/A'}</div>
                        </div>
                        ${analysis?.transcript_metadata ? `
                            <h5 style="margin-top: 15px;">Content Metadata</h5>
                            <div class="detail-grid">
                                ${Object.entries(analysis.transcript_metadata).map(([key, value]) => `
                                    <div><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    compareSelected() {
        // For now, this just scrolls to show all reports
        // In a more advanced version, this could create a dedicated comparison view
        const reportsContainer = document.querySelector('.reports-container');
        reportsContainer.scrollIntoView({ behavior: 'smooth' });
        
        if (this.loadedReports.size < 2) {
            alert('Load at least 2 reports to compare');
            return;
        }
        
        // Show success message
        this.showMessage(`Comparing ${this.loadedReports.size} reports side-by-side`);
    }

    removeReport(reportId) {
        this.loadedReports.delete(reportId);
        this.updateDisplay();
    }

    clearAllReports() {
        this.loadedReports.clear();
        this.updateDisplay();
    }

    showError(message) {
        // Simple error display - could be enhanced with better UI
        console.error(message);
        alert(`Error: ${message}`);
    }

    showMessage(message) {
        // Simple message display
        console.log(message);
        const msg = document.createElement('div');
        msg.textContent = message;
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, initializing EvaluationVisualizer');
    try {
        new EvaluationVisualizer();
    } catch (error) {
        console.error('Error initializing EvaluationVisualizer:', error);
    }
}); 