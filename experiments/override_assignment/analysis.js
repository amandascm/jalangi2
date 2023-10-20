// do not remove the following comment
// JALANGI DO NOT INSTRUMENT

/**
 * @author  Koushik Sen
 *
 */

(function (sandbox) {
    const path = require('node:path')

    if (sandbox.Constants.isBrowser) {
        sandbox.Results = {};
    }

    function MyAnalysis() {

        const TEST_CASE = J$.initParams.testCase

        // Input: represents all lines that came from Left (L) or Right (R) branches - the rest is assumed to be from base
        const LINE_TO_BRANCH_MAP = require(path.join(__dirname, 'test_cases', `${TEST_CASE}`, 'line_to_branch_map.json'))

        class Assignment {
            constructor (frameOrObjectID, nameOrField, line, branch = undefined, isObject = false) {
                this.frameOrObjectID = frameOrObjectID
                this.nameOrField = nameOrField
                this.isObject = isObject
                this.branch = branch
                this.line = line
            }

            getLHSIdentifier () {
                return `${this.frameOrObjectID}_${this.nameOrField}`
            }

            getBranch () {
                return this.branch
            }

            getLine () {
                return this.line
            }

            setBranch (branch) {
                this.branch = branch
            }
        }

        class Interference {
            constructor (previousAssignment, currentAssignment) {
                this.previousAssignment = previousAssignment
                this.currentAssignment = currentAssignment
            }

            getPreviousAssigment () {
                return this.previousAssignment
            }

            getCurrentAsssignment () {
                return this.currentAssignment
            }

            log () {
                console.log(`----Override assignment detected on ${this.previousAssignment.getLHSIdentifier()}: branch ${this.previousAssignment.getBranch()} at line ${this.previousAssignment.getLine()}, branch ${this.currentAssignment.getBranch()} at line ${this.currentAssignment.getLine()}----`)
            }
        }

        class FunctionCall {
            constructor (functionID, name, location, beforeInvoke, branch = undefined) {
                this.functionID = functionID
                this.name = name
                this.branch = branch
                this.location = location
                this.beforeInvoke = beforeInvoke
            }

            getIdentifier () {
                return `${this.functionID}_${this.name}`
            }

            getBranch () {
                return this.branch
            }

            getLocation () {
                return this.location
            }

            getTrace () {
                return `${this.getLocation} in ${this.name}`
            }

            setBranch (branch) {
                this.branch = branch
            }

            isBeforeInvoke () {
                return this.beforeInvoke
            }
        }

        class OverrideAssignmentController {
            constructor () {
                this.branchAssignmentSets = {}
                this.functionCallStack = [] // In the format [{FUNCTION: BRANCH}]
            }

            addFunctionToStack (func) {
                this.functionCallStack.push(func)
            }

            removeFunctionFromStack (func) {
                this.functionCallStack.pop()
            }

            getBranchFromFunctionStack () {
                if (this.functionCallStack.length) {
                    return this.functionCallStack.at(-1).getBranch()
                }
                return undefined
            }

            isFunctionStackEmpty () {
                return this.functionCallStack.length === 0
            }

            functionHandler (func) {
                if ((!this.isFunctionStackEmpty() || func.getBranch()) && func.isBeforeInvoke()) {
                    if (!func.getBranch()) func.setBranch(this.getBranchFromFunctionStack())
                    this.addFunctionToStack(func)
                } else if (!func.isBeforeInvoke()) {
                    this.removeFunctionFromStack(func)
                }
            }

            updateAssignBranchBasedOnFunctionStack (assignment) {
                if (!assignment.getBranch()) {
                    assignment.setBranch(this.getBranchFromFunctionStack())
                }
            }

            assignmentExistsOnOtherBranch (assignment) {
                const assignmentIdentifier = assignment.getLHSIdentifier()
                const currentBranch = assignment.getBranch()

                for (let branch of Object.keys(this.branchAssignmentSets)) {
                    if (branch !== currentBranch && this.branchAssignmentSets[branch][assignmentIdentifier]){
                        return new Interference(this.branchAssignmentSets[branch][assignmentIdentifier], assignment)
                    }
                }
                return undefined
            }

            handler (assignment) {
                this.updateAssignBranchBasedOnFunctionStack(assignment)
                const currentBranch = assignment.getBranch()
                if (currentBranch) {
                    const interference = this.assignmentExistsOnOtherBranch(assignment)
                    interference?.log()
    
                    const assignmentIdentifier = assignment.getLHSIdentifier()
                    if (!this.branchAssignmentSets[currentBranch]) {
                        this.branchAssignmentSets[currentBranch] = {};
                    }
                    this.branchAssignmentSets[currentBranch][assignmentIdentifier] = assignment;
                }
                this.removeAssignmentFromOtherBranches(assignment)
            }

            removeAssignmentFromBranch (assignment, branch) {
                const assignmentIdentifier = assignment.getLHSIdentifier()

                if (this.branchAssignmentSets[branch][assignmentIdentifier]) {
                    delete this.branchAssignmentSets[branch][assignmentIdentifier]
                }
            }
    
            removeAssignmentFromOtherBranches (assignment) {
                // console.log(`remove ${assignmentIdentifier}`)
                const currentBranch = assignment.getBranch()
                const assignmentOnBaseBranch = currentBranch === undefined
                for (let branch of Object.keys(this.branchAssignmentSets)) {
                    if (assignmentOnBaseBranch || (!assignmentOnBaseBranch && branch !== currentBranch)) {
                        this.removeAssignmentFromBranch(assignment, branch)
                    }
                }
            }
        }

        class MergeController {            
            constructor (linesBranchMap = LINE_TO_BRANCH_MAP) {
                this.linesBranchMap = linesBranchMap
            }

            mapLineToBranch(sourceFileLine) {
                return LINE_TO_BRANCH_MAP[sourceFileLine] ?? undefined
            }
    
        }

        function getSourceFileCorrespondingLine (location) {
            // location in the format: file_path.js:15:25:15:28
            return Number(location.split(':')[1])
        }

        const overrideAssignmentController = new OverrideAssignmentController()
        const mergeController = new MergeController()

        this.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod, functionIid, functionSid) {
            const location = J$.iidToLocation(J$.sid, iid)
            const line = getSourceFileCorrespondingLine(location)
            const branch = mergeController.mapLineToBranch(line)

            if (isMethod) {
                const actualObjectId = sandbox.smemory.getIDFromShadowObjectOrFrame(sandbox.smemory.getShadowObject(base, false).owner)
                if (f == Array.prototype.push) {
                    const affectedLength = Object.keys(args).length
                    const affectedMinIdx = base.length
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
                if (f == Array.prototype.pop) { // removes
                    const offset = (base.length - 1)
                    const assignment = new Assignment(actualObjectId, offset, line, branch)
                    overrideAssignmentController.handler(assignment)
                }
                if (f == Array.prototype.unshift) {
                    const affectedLength = Object.keys(args).length + base.length
                    const affectedMinIdx = 0
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
                if (f == Array.prototype.shift) { // removes
                    const affectedLength = base.length
                    const affectedMinIdx = 0
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
                if (f == Array.prototype.splice) { // removes
                    const elementsToAdd = (Object.keys(args).length - 2) ?? 0
                    const elementsToRemove = (typeof args[1] == "number") ? args[1] : 0
                    const affectedMinIdx = args[0]
                    const affectedLength = (elementsToAdd - elementsToRemove) > 0 // consider the biggest array
                        ? base.length - (affectedMinIdx) + (elementsToAdd - elementsToRemove) 
                        : elementsToAdd === elementsToRemove && elementsToRemove !== 0 // Added as much as removed in the same positions, doesn't affect other positions
                            ? elementsToAdd
                            : base.length - (affectedMinIdx)
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
                if (f == Array.prototype.fill) {
                    const affectedMinIdx = args[1] ?? 0
                    const affectedLength = (args[2] ?? base.length) - affectedMinIdx
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
                if (f == Array.prototype.copyWithin) {
                    const affectedMinIdx = args[0] // target
                    const start = args[1] ?? 0 // start
                    const end = args[2] ?? base.length // end
                    const affectedLength = end -  start - affectedMinIdx
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)
                    // console.log(affectedMinIdx, affectedLength, offsets, base)

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
                if (f == Array.prototype.reverse) {
                    const affectedMinIdx = 0
                    const affectedLength = base.length
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)
                    offsets.splice(base.length / 2, base.length % 2 === 0 ? 0 : 1)

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
                if (f == Array.prototype.sort) {
                    const affectedMinIdx = 0
                    const affectedLength = base.length
                    const offsets = Array.from({ length: affectedLength}, (_, index) => index + affectedMinIdx)
                    const sortedArray = base.sort(args[0] ?? undefined)
                    offsets.filter((offset) => base[offset] !== sortedArray[offset])

                    for (let offset of offsets) {
                        const assignment = new Assignment(actualObjectId, offset, line, branch)
                        overrideAssignmentController.handler(assignment)
                    }
                }
            }

            overrideAssignmentController.functionHandler(new FunctionCall(functionIid, f.name, location, true, branch))
        };

        this.invokeFun = function (iid, f, base, args, result, isConstructor, isMethod, functionIid, functionSid) {
            const location = J$.iidToLocation(J$.sid, iid)
            const line = getSourceFileCorrespondingLine(location)
            const branch = mergeController.mapLineToBranch(line)
            overrideAssignmentController.functionHandler(new FunctionCall(functionIid, f.name, location, false, branch))
        };

        this.putFieldPre = function (iid, base, offset, val, isComputed, isOpAssign) {
            const actualObjectId = sandbox.smemory.getIDFromShadowObjectOrFrame(sandbox.smemory.getShadowObject(base, offset, false).owner)
            const location = J$.iidToLocation(J$.sid, iid)
            const line = getSourceFileCorrespondingLine(location)
            const branch = mergeController.mapLineToBranch(line)

            const assignment = new Assignment(actualObjectId, offset, line, branch)
            overrideAssignmentController.handler(assignment)
        };

        this.write = function (iid, name, val, lhs, isGlobal, isScriptLocal) {
            const frameId = sandbox.smemory.getIDFromShadowObjectOrFrame(sandbox.smemory.getShadowFrame(name))
            const location = J$.iidToLocation(J$.sid, iid)
            const line = getSourceFileCorrespondingLine(location)
            const branch = mergeController.mapLineToBranch(line)

            const assignment = new Assignment(frameId, name, line, branch)
            overrideAssignmentController.handler(assignment)

            return {result: val}
        };

        this.endExecution = function () {
            if (sandbox.Results) {
                for (let i = 0; i < logs.length; i++) {
                    sandbox.log(logs[i]);
                }
            }
        };
    }

    sandbox.analysis = new MyAnalysis();

}(J$));

/*
 node src/js/commands/jalangi.js --inlineIID --inlineSource --analysis src/js/sample_analyses/ChainedAnalyses.js --analysis src/js/runtime/SMemory.js --analysis experiments/override_assignment/analysis.js experiments/override_assignment/test_cases/example.js
 node src/js/commands/jalangi.js --inlineIID --inlineSource --analysis src/js/sample_analyses/ChainedAnalyses.js --analysis src/js/runtime/SMemory.js --analysis src/js/sample_analyses/pldi16/LogLoadStore.js tests/pldi16/CountObjectsPerAllocationSiteTest.js
 node src/js/commands/esnstrument_cli.js --inlineIID --inlineSource --analysis src/js/sample_analyses/ChainedAnalyses.js --analysis src/js/runtime/SMemory.js --analysis src/js/sample_analyses/pldi16/LogLoadStore.js --out /tmp/pldi16/CountObjectsPerAllocationSiteTest.html  tests/pldi16/CountObjectsPerAllocationSiteTest.html
 node src/js/commands/esnstrument_cli.js --inlineIID --inlineSource --analysis src/js/sample_analyses/ChainedAnalyses.js --analysis src/js/runtime/SMemory.js --analysis src/js/sample_analyses/pldi16/LogLoadStore.js --out /tmp/pldi16/CountObjectsPerAllocationSiteTest.js  tests/pldi16/CountObjectsPerAllocationSiteTest.js
 open file:///tmp/pldi16/CountObjectsPerAllocationSiteTest.html
 */


