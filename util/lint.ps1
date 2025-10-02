# Copyright(C) 2024-2025 Advanced Micro Devices, Inc. All rights reserved.
# SPDX-License-Identifier: MIT

param(
    [switch]$RunPylint,
    [switch]$RunBlack,
    [switch]$RunIsort,
    [switch]$RunFlake8,
    [switch]$RunMyPy,
    [switch]$RunBandit,
    [switch]$RunImportTests,
    [switch]$All,
    [switch]$Fix
)

# Configuration
$PYTHON_PATH = "python"
$PYLINT_PATH = "pylint"
$SRC_DIR = "src\gaia"
$TEST_DIR = "tests"
$INSTALLER_DIR = "installer"
$PYLINT_CONFIG = ".pylintrc"
$DISABLED_CHECKS = "C0103,C0301,W0246,W0221,E1102,R0401,E0401,W0718"
$EXCLUDE_DIRS = ".git,__pycache__,venv,.venv,.mypy_cache,.tox,.eggs,_build,buck-out,node_modules"

$ErrorCount = 0
$WarningCount = 0

# Function to run Black
function Invoke-Black {
    Write-Host "`n[1/7] Checking code formatting with Black..." -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    if ($Fix) {
        & $PYTHON_PATH -m black $INSTALLER_DIR $SRC_DIR $TEST_DIR --config pyproject.toml
    } else {
        & $PYTHON_PATH -m black --check --diff $INSTALLER_DIR $SRC_DIR $TEST_DIR --config pyproject.toml
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[!] Code formatting issues found." -ForegroundColor Red
        if (-not $Fix) {
            Write-Host "Fix with: powershell util\lint.ps1 -RunBlack -Fix" -ForegroundColor Yellow
        }
        $script:ErrorCount++
        return $false
    }
    Write-Host "[OK] Code formatting looks good!" -ForegroundColor Green
    return $true
}

# Function to run isort
function Invoke-Isort {
    Write-Host "`n[2/7] Checking import sorting with isort..." -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    if ($Fix) {
        & $PYTHON_PATH -m isort $INSTALLER_DIR $SRC_DIR $TEST_DIR
    } else {
        & $PYTHON_PATH -m isort --check-only --diff $INSTALLER_DIR $SRC_DIR $TEST_DIR
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[!] Import sorting issues found." -ForegroundColor Red
        if (-not $Fix) {
            Write-Host "Fix with: powershell util\lint.ps1 -RunIsort -Fix" -ForegroundColor Yellow
        }
        $script:ErrorCount++
        return $false
    }
    Write-Host "[OK] Import sorting looks good!" -ForegroundColor Green
    return $true
}

# Function to run Pylint
function Invoke-Pylint {
    Write-Host "`n[3/7] Running Pylint (errors only)..." -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    & $PYTHON_PATH -m $PYLINT_PATH $SRC_DIR --rcfile $PYLINT_CONFIG --disable $DISABLED_CHECKS

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[!] Pylint found critical errors." -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
    Write-Host "[OK] No critical Pylint errors!" -ForegroundColor Green
    return $true
}

# Function to run Flake8
function Invoke-Flake8 {
    Write-Host "`n[4/7] Running Flake8..." -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    & $PYTHON_PATH -m flake8 $INSTALLER_DIR $SRC_DIR $TEST_DIR --exclude=$EXCLUDE_DIRS --count --statistics --max-line-length=88 --extend-ignore=E203,W503

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[!] Flake8 found style issues." -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
    Write-Host "[OK] Flake8 checks passed!" -ForegroundColor Green
    return $true
}

# Function to run MyPy
function Invoke-MyPy {
    Write-Host "`n[5/7] Running MyPy type checking (warning only)..." -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    & $PYTHON_PATH -m mypy $SRC_DIR --ignore-missing-imports 2>$null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[WARNING] MyPy found type issues (non-blocking)." -ForegroundColor Yellow
        $script:WarningCount++
        return $true
    }
    Write-Host "[OK] Type checking passed!" -ForegroundColor Green
    return $true
}

# Function to run Bandit
function Invoke-Bandit {
    Write-Host "`n[6/7] Running security check with Bandit (warning only)..." -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    & $PYTHON_PATH -m bandit -r $SRC_DIR -ll --exclude $EXCLUDE_DIRS 2>$null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[WARNING] Bandit found security issues (non-blocking)." -ForegroundColor Yellow
        Write-Host "Note: Many are false positives for ML applications." -ForegroundColor Yellow
        $script:WarningCount++
        return $true
    }
    Write-Host "[OK] No security issues found!" -ForegroundColor Green
    return $true
}

# Function to test imports
function Invoke-ImportTests {
    Write-Host "`n[7/7] Testing critical imports..." -ForegroundColor Cyan
    Write-Host "----------------------------------------"

    $imports = @(
        @{Module="gaia.cli"; Desc="CLI module"},
        @{Module="gaia.chat.sdk"; Desc="Chat SDK"},
        @{Module="gaia.llm.llm_client"; Desc="LLM client"},
        @{Module="gaia.agents.base.agent"; Desc="Base agent"}
    )

    $failed = $false
    foreach ($import in $imports) {
        & $PYTHON_PATH -c "import $($import.Module); print('OK: $($import.Desc) imports')"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[!] Failed to import $($import.Module)" -ForegroundColor Red
            $failed = $true
        }
    }

    if ($failed) {
        $script:ErrorCount++
        return $false
    }
    Write-Host "[OK] All imports working!" -ForegroundColor Green
    return $true
}

# Print header
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running Code Quality Checks" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Run based on arguments
# If no specific options are provided, run all by default
if (-not ($RunPylint -or $RunBlack -or $RunIsort -or $RunFlake8 -or $RunMyPy -or $RunBandit -or $RunImportTests -or $All)) {
    $All = $true
}

if ($RunBlack -or $All) {
    Invoke-Black | Out-Null
}

if ($RunIsort -or $All) {
    Invoke-Isort | Out-Null
}

if ($RunPylint -or $All) {
    Invoke-Pylint | Out-Null
}

if ($RunFlake8 -or $All) {
    Invoke-Flake8 | Out-Null
}

if ($RunMyPy -or $All) {
    Invoke-MyPy | Out-Null
}

if ($RunImportTests -or $All) {
    Invoke-ImportTests | Out-Null
}

if ($RunBandit -or $All) {
    Invoke-Bandit | Out-Null
}

# Print summary
Write-Host "`n========================================" -ForegroundColor Cyan
if ($ErrorCount -eq 0) {
    Write-Host "All Quality Checks Passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "`nQuality Standards Met:" -ForegroundColor Green
    Write-Host "  - Code formatting (Black)" -ForegroundColor Green
    Write-Host "  - Import sorting (isort)" -ForegroundColor Green
    Write-Host "  - No critical linting errors (Pylint)" -ForegroundColor Green
    Write-Host "  - Style compliance (Flake8)" -ForegroundColor Green
    Write-Host "  - Type checking (MyPy)" -ForegroundColor Green
    Write-Host "  - Import validation" -ForegroundColor Green
    if ($WarningCount -gt 0) {
        Write-Host "`nWarnings: $WarningCount (non-blocking)" -ForegroundColor Yellow
    }
    Write-Host "`nYour code is ready for PR submission!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Quality Checks Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "`nErrors: $ErrorCount" -ForegroundColor Red
    if ($WarningCount -gt 0) {
        Write-Host "Warnings: $WarningCount (non-blocking)" -ForegroundColor Yellow
    }
    Write-Host "`nPlease fix the errors above before submitting a PR." -ForegroundColor Red
    exit 1
}
