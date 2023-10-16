const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')

// Initialize variables to store argument values
const DEFAULT_TO_ALL = 'all'
let testCaseValue = DEFAULT_TO_ALL // Default value for testCase
let conflictAnalysisValue = DEFAULT_TO_ALL // Default value for conflictAnalysis

// Define allowed values for --conflictAnalysis
const ALLOWED_CONFLICT_ANALYSES = ['override_assignment']

// Paths
let BASE_DIR = path.join(__dirname, '..')
let AVAILABLE_ANALYSES_DIR = path.join(BASE_DIR, 'experiments')

const updateParamsWithArguments = () => {
  // Process command-line arguments
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--testCase=')) {
      // Extract the value following '--testCase'
      testCaseValue = arg.substring('--testCase='.length)
    } else if (arg.startsWith('--conflictAnalysis=')) {
      // Extract the value following '--conflictAnalysis'
      const providedValue = arg.substring('--conflictAnalysis='.length)
      if (ALLOWED_CONFLICT_ANALYSES.includes(providedValue)) {
        conflictAnalysisValue = providedValue
      } else {
        console.log('Invalid conflictAnalysis value provided.')
        return
      }
    }
  }

  console.log(`Test case value: ${testCaseValue}`)
  console.log(`Conflict analysis value: ${conflictAnalysisValue}`)
}

class AnalysisUnit {
  constructor(conflictAnalysis, testCase, command) {
    this.conflictAnalysis= conflictAnalysis
    this.testCase = testCase, 
    this.command = command
  }
}

const buildAnalysisUnit = (testCase, conflictAnalysis) => {
  let chainedAnalysesPath = path.join(BASE_DIR, 'src', 'js', 'sample_analyses', 'ChainedAnalyses.js')
  let smemoryAnalysisPath = path.join(BASE_DIR, 'src', 'js', 'runtime', 'SMemory.js')
  
  return new AnalysisUnit(
    conflictAnalysis,
    testCase,
    `node src/js/commands/jalangi.js --initParam testCase:${testCase} --inlineIID --inlineSource --analysis ${chainedAnalysesPath} --analysis ${smemoryAnalysisPath} --analysis ${path.join(AVAILABLE_ANALYSES_DIR, conflictAnalysis, 'analysis.js')} ${path.join(AVAILABLE_ANALYSES_DIR, conflictAnalysis, 'test_cases', testCase, 'index.js')}`
  )
}

function listDirectoriesInBaseDir(baseDir) {
  const dirPath = path.join(baseDir);

  try {
    const subDirs = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    return subDirs;
  } catch (error) {
    console.error(`Error reading directories in ${dirPath}: ${error.message}`);
    return [];
  }
}

const getAnalysisAvailableTestCases = (conflictAnalysis) => {
  return listDirectoriesInBaseDir(path.join(AVAILABLE_ANALYSES_DIR, conflictAnalysis, 'test_cases'))
}

const getAnalysisTestCasesUnities = (conflictAnalysis) => {
  const testCases = getAnalysisAvailableTestCases(conflictAnalysis)
  return testCases.map(
    (testCase) => buildAnalysisUnit(testCase, conflictAnalysis)
  )
}

const runAnalysisUnit = analysisUnit => {
  exec(analysisUnit.command, (error, stdout, stderr) => {
    console.log(` - Test case: ${analysisUnit.testCase}`)
    if (error) {
      console.error(`    Error: ${error}`)
      return
    }
    console.log(`    Output: ${stdout}`)
  })
}

const runAnalysis = (conflictAnalysis, testCase) => {
  console.log(`\nSTARTING TO RUN ANALYSIS: ${conflictAnalysis}...`)
  switch (testCase) {
    case DEFAULT_TO_ALL:
      getAnalysisTestCasesUnities(conflictAnalysis)
        .forEach((testCaseCommand) => {
          runAnalysisUnit(testCaseCommand)
        })
      break
    default:
      runAnalysisUnit(buildAnalysisUnit(testCase, conflictAnalysis))
      break
  }
}

const getAvailableAnalyses = () => {
  return listDirectoriesInBaseDir(path.join(AVAILABLE_ANALYSES_DIR))
}

const runAnalyses = (conflictAnalysisValue, testCaseValue) => {
  switch (conflictAnalysisValue) {
    case DEFAULT_TO_ALL:
      const analyses = getAvailableAnalyses()
      for (let conflictAnalysis of analyses) {
        runAnalysis(conflictAnalysis, testCaseValue)
      }
      break
    default:
      runAnalysis(conflictAnalysisValue, testCaseValue)
      break
  }
}


updateParamsWithArguments()
runAnalyses(conflictAnalysisValue, testCaseValue)

