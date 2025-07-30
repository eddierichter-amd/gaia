const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies
app.use(express.json());

// Base paths for data files - use environment variables or defaults
const EXPERIMENTS_PATH = process.env.EXPERIMENTS_PATH || path.join(__dirname, '../../../..', 'experiments');
const EVALUATIONS_PATH = process.env.EVALUATIONS_PATH || path.join(__dirname, '../../../..', 'evaluation');

// API endpoint to list available files
app.get('/api/files', (req, res) => {
    try {
        const experiments = fs.existsSync(EXPERIMENTS_PATH) 
            ? fs.readdirSync(EXPERIMENTS_PATH).filter(file => file.endsWith('.experiment.json'))
            : [];
        
        const evaluations = fs.existsSync(EVALUATIONS_PATH)
            ? fs.readdirSync(EVALUATIONS_PATH).filter(file => file.endsWith('.experiment.eval.json'))
            : [];

        res.json({
            experiments: experiments.map(file => ({
                name: file,
                path: path.join(EXPERIMENTS_PATH, file),
                type: 'experiment'
            })),
            evaluations: evaluations.map(file => ({
                name: file,
                path: path.join(EVALUATIONS_PATH, file),
                type: 'evaluation'
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list files', details: error.message });
    }
});

// API endpoint to load experiment data
app.get('/api/experiment/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(EXPERIMENTS_PATH, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load experiment', details: error.message });
    }
});

// API endpoint to load evaluation data
app.get('/api/evaluation/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(EVALUATIONS_PATH, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load evaluation', details: error.message });
    }
});

// API endpoint to get combined report (experiment + evaluation)
app.get('/api/report/:experimentFile/:evaluationFile?', (req, res) => {
    try {
        const experimentFile = req.params.experimentFile;
        const evaluationFile = req.params.evaluationFile;

        // Load experiment data
        const experimentPath = path.join(EXPERIMENTS_PATH, experimentFile);
        if (!fs.existsSync(experimentPath)) {
            return res.status(404).json({ error: 'Experiment file not found' });
        }
        const experimentData = JSON.parse(fs.readFileSync(experimentPath, 'utf8'));

        let evaluationData = null;
        if (evaluationFile) {
            const evaluationPath = path.join(EVALUATIONS_PATH, evaluationFile);
            if (fs.existsSync(evaluationPath)) {
                evaluationData = JSON.parse(fs.readFileSync(evaluationPath, 'utf8'));
            }
        }

        res.json({
            experiment: experimentData,
            evaluation: evaluationData,
            combined: true
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load report', details: error.message });
    }
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Gaia Evaluation Visualizer running on http://localhost:${PORT}`);
    console.log(`Experiments path: ${EXPERIMENTS_PATH}`);
    console.log(`Evaluations path: ${EVALUATIONS_PATH}`);
}); 