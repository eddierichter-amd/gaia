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
            const response = await fetch('/api/files');
            console.log('Response received:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Data received:', data);
            
            this.populateFileSelects(data);
        } catch (error) {
            console.error('Failed to load available files:', error);
            this.showError('Failed to load available files');
        }
    }

    populateFileSelects(data) {
        console.log('Populating file selects with data:', data);
        const experimentSelect = document.getElementById('experimentSelect');
        const evaluationSelect = document.getElementById('evaluationSelect');

        if (!experimentSelect || !evaluationSelect) {
            console.error('Select elements not found in DOM');
            return;
        }

        // Clear existing options
        experimentSelect.innerHTML = '';
        evaluationSelect.innerHTML = '';

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
        console.log('File selects populated successfully');
    }

    async addSelectedReports() {
        console.log('addSelectedReports function called');
        
        const experimentSelect = document.getElementById('experimentSelect');
        const evaluationSelect = document.getElementById('evaluationSelect');

        if (!experimentSelect || !evaluationSelect) {
            console.error('Select elements not found');
            alert('Error: File selection elements not found');
            return;
        }

        const selectedExperiments = Array.from(experimentSelect.selectedOptions);
        const selectedEvaluations = Array.from(evaluationSelect.selectedOptions);

        console.log('Selected experiments:', selectedExperiments.length);
        console.log('Selected evaluations:', selectedEvaluations.length);

        if (selectedExperiments.length === 0 && selectedEvaluations.length === 0) {
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

        // Clear selections
        experimentSelect.selectedIndex = -1;
        evaluationSelect.selectedIndex = -1;

        this.updateDisplay();
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

    updateDisplay() {
        const reportsGrid = document.getElementById('reportsGrid');
        
        if (this.loadedReports.size === 0) {
            reportsGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No reports loaded</h3>
                    <p>Select experiment and/or evaluation files to visualize results</p>
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
        
        let title = reportId;
        let subtitle = '';
        
        if (hasExperiment && hasEvaluation) {
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
                    ${this.generateMetricsSection(report)}
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
                    { label: 'Quality Score', value: metrics_data.quality_score?.toFixed(1) || 'N/A' },
                    { label: 'Excellent', value: metrics_data.excellent_count || 0 },
                    { label: 'Good', value: metrics_data.good_count || 0 },
                    { label: 'Fair', value: metrics_data.fair_count || 0 },
                    { label: 'Poor', value: metrics_data.poor_count || 0 }
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
            { label: 'Executive Summary', rating: analysis.executive_summary_quality?.rating },
            { label: 'Detail Completeness', rating: analysis.detail_completeness?.rating },
            { label: 'Action Items Structure', rating: analysis.action_items_structure?.rating },
            { label: 'Key Decisions Clarity', rating: analysis.key_decisions_clarity?.rating },
            { label: 'Participant Information', rating: analysis.participant_information?.rating },
            { label: 'Topic Organization', rating: analysis.topic_organization?.rating }
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
                    { key: 'executive_summary_quality', label: 'Executive Summary Quality' },
                    { key: 'detail_completeness', label: 'Detail Completeness' },
                    { key: 'action_items_structure', label: 'Action Items Structure' },
                    { key: 'key_decisions_clarity', label: 'Key Decisions Clarity' },
                    { key: 'participant_information', label: 'Participant Information' },
                    { key: 'topic_organization', label: 'Topic Organization' }
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