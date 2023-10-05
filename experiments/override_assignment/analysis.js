// do not remove the following comment
// JALANGI DO NOT INSTRUMENT

/**
 * @author  Koushik Sen
 *
 */

(function (sandbox) {

    if (sandbox.Constants.isBrowser) {
        sandbox.Results = {};
    }

    function MyAnalysis() {

        // Input: represents all lines that came from Left (L) or Right (R) branches - the rest is assumed to be from base
        var MOCK_LINES_BRANCH_MAP = {
            7: 'L',
            9: 'R',
            12: 'R',
            27: 'R',
            30: 'L'
        }

        class Assignment {
            constructor (frameOrObjectID, nameOrField, location, branch = undefined, isObject = false) {
                this.frameOrObjectID = frameOrObjectID
                this.nameOrField = nameOrField
                this.isObject = isObject
                this.branch = branch
                this.location = location
            }

            getLHSIdentifier () {
                return `${this.frameOrObjectID}_${this.nameOrField}`
            }

            getBranch () {
                return this.branch
            }

            getLocation () {
                return this.location
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
                console.log(`----Override assignment detected on ${this.previousAssignment.getLHSIdentifier()}: branch ${this.previousAssignment.getBranch()} at line ${this.previousAssignment.getLocation()}, branch ${this.currentAssignment.getBranch()} at line ${this.currentAssignment.getLocation()}----`)
            }
        }

        class OverrideAssignmentController {
            constructor () {
                this.branchAssignmentSets = {}
            }

            assignmentExistsOnOtherBranch (assignment) {
                // console.log('assignmentExistsOnOtherBranch')
                var assignmentIdentifier = assignment.getLHSIdentifier()
                var currentBranch = assignment.getBranch()

                for (var branch of Object.keys(this.branchAssignmentSets)) {
                    if (branch !== currentBranch && this.branchAssignmentSets[branch][assignmentIdentifier]){
                        return new Interference(this.branchAssignmentSets[branch][assignmentIdentifier], assignment)
                    }
                }
                return undefined
            }

            handler (assignment) {
                var currentBranch = assignment.getBranch()
                if (currentBranch) {
                    var interference = this.assignmentExistsOnOtherBranch(assignment)
                    interference?.log()
    
                    var assignmentIdentifier = assignment.getLHSIdentifier()
                    if (!this.branchAssignmentSets[currentBranch]) {
                        this.branchAssignmentSets[currentBranch] = {};
                    }
                    this.branchAssignmentSets[currentBranch][assignmentIdentifier] = assignment;
                }
                this.removeAssignmentFromOtherBranches(assignment)
            }

            removeAssignmentFromBranch (assignment, branch) {
                var assignmentIdentifier = assignment.getLHSIdentifier()

                if (this.branchAssignmentSets[branch][assignmentIdentifier]) {
                    delete this.branchAssignmentSets[branch][assignmentIdentifier]
                }
            }
    
            removeAssignmentFromOtherBranches (assignment) {
                // console.log(`remove ${assignmentIdentifier}`)
                var currentBranch = assignment.getBranch()
                var assignmentOnBaseBranch = currentBranch === undefined
                for (var branch of Object.keys(this.branchAssignmentSets)) {
                    if (assignmentOnBaseBranch || (!assignmentOnBaseBranch && branch !== currentBranch)) {
                        this.removeAssignmentFromBranch(assignment, branch)
                    }
                }
            }
        }

        class MergeController {            
            constructor (linesBranchMap = MOCK_LINES_BRANCH_MAP) {
                this.linesBranchMap = linesBranchMap
            }

            mapLineToBranch(sourceFileLine) {
                // console.log('mapLineToBranch')
                var branch = MOCK_LINES_BRANCH_MAP[sourceFileLine]
                if (branch) return branch
                else return undefined
            }
    
        }

        function getSourceFileCorrespondingLine (location) {
            // console.log('getSourceFileCorrespondingLine')
            // location in the format: file_path.js:15:25:15:28
            return Number(location.split(':')[1])
        }

        var overrideAssignmentController = new OverrideAssignmentController()
        var mergeController = new MergeController()

        this.invokeFunPre = function (iid, f, base, args, isConstructor, isMethod, functionIid, functionSid) {
            // console.log('invokeFunPre')
        };

        this.invokeFun = function (iid, f, base, args, result, isConstructor, isMethod, functionIid, functionSid) {
            // console.log('invokeFun')
        };

        this.putFieldPre = function (iid, base, offset, val, isComputed, isOpAssign) {
            var actualObjectId = sandbox.smemory.getIDFromShadowObjectOrFrame(sandbox.smemory.getShadowObject(base, offset, false).owner)
            var location = J$.iidToLocation(J$.sid, iid)
            var line = getSourceFileCorrespondingLine(location)
            var branch = mergeController.mapLineToBranch(line)

            var assignment = new Assignment(actualObjectId, offset, line, branch)
            overrideAssignmentController.handler(assignment)
        };

        this.write = function (iid, name, val, lhs, isGlobal, isScriptLocal) {
            var frameId = sandbox.smemory.getIDFromShadowObjectOrFrame(sandbox.smemory.getShadowFrame(name))
            var location = J$.iidToLocation(J$.sid, iid)
            var line = getSourceFileCorrespondingLine(location)
            var branch = mergeController.mapLineToBranch(line)

            var assignment = new Assignment(frameId, name, line, branch)
            overrideAssignmentController.handler(assignment)

            return {result: val}
        };

        this.endExecution = function () {
            if (sandbox.Results) {
                for (var i = 0; i < logs.length; i++) {
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


