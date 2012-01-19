

var genedice = genedice || {};

(function(global){

    genedice.Boot = function(){
        var container = $('body').create('div', '', {id: 'container'});
        var dieString = genedice.Boot.getURLParameter('d');
        if(dieString){
            var callbackName = genedice.Boot.getURLParameter('c');
            var parallelDie = genedice.Boot.getURLParameter('p');
            //run a simulation
            container.create('canvas', '', {id: 'canvas'});
            var simulation = new genedice.Simulation();
            simulation.init(dieString, callbackName, parallelDie);
            simulation.update();
        } else {
            //run the controller
            var c = _.bind(container.create, container);
            c('h1', 'genedice');
            c('h2', 'dice evolver');
            var form = c('form', '', {id: 'form'});
            var f = _.bind(form.create, form);
            f('span', 'enter relative face probabilities');
//            f('input', '', {name: 'ratios', type:'text', value: '1,2,3,4,5,6,5,4,3,2,1'});
            f('input', '', {name: 'ratios', type:'text', value: '1,1,1,1,1,1'});
            f('br');
            f('span', 'initial face pool(optional)');
            f('input', '', {name: 'initial', type:'text', value: ''});
            f('br');
            var start = f('input', '', {name: 'submit', type: 'submit', value: 'start evolving'});
            var stop = f('input', '', {id: 'stop', name: 'stop', type:'submit', value: 'stop evolving'});
            f('br');

            c('div', 'log:');
            c('textarea', '', {id: 'status', value: '', readonly: true, cols: 80, rows: 10, style: "white-space: nowrap; overflow: auto;"});

            c('div', 'current pool:');
            c('textarea', '', {id: 'current', value: '', readonly: true, cols: 80, rows: 2});

            var controller = new genedice.Controller();
            var onClick = function(){controller.start(form[0].ratios.value, form[0].initial.value); return false;};
            start.click(onClick);
            stop.click(function(){controller.stop(); return false;});
//            onClick();
//            controller.start();
        }
    };
    _.extend(genedice.Boot, {
        getURLParameter: function(name) {
            return decodeURIComponent((RegExp('[?|&]' + name + '=' + '(.+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null;
        }
    });


    genedice.Controller = function(){
    };
    genedice.Controller.prototype = {
        start: function(ratiosString, initialPool){

            //this.simulator = new genedice.RemoteSimulator();
            //this.simulator.init();
            this.log('STARTING EVOLUTION');

            this.targetRatios = this.parseRatioString(ratiosString);
//            console.log(this.targetRatiosSorted);

            this.numSides = this.targetRatios.length;

            this.poolSize = 16;
//            this.pool = this.makeInitialPool();

//            console.log('initial pool', initialPool);
            var pool;
            if(initialPool){
                pool = genedice.Die.deserializeOffsetGroup(initialPool);
            } else {
                pool = this.makeInitialPool();
            }
            this.startPool(pool);
            this.mainLoop();
//            var die = genedice.Die.deserializeFaceOffsets('1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1');
//            die = genedice.Die.getValidMutatedOffsets(die);
//            die = genedice.Die.serializeFaceOffsets(die);
//            this.runSimulation(die, 1024);
        },
        startPool: function(faceOffsetArr){
            this.simQueue = faceOffsetArr;
            this.simResults = [];
            var queueStr = genedice.Die.serializeOffsetGroup(this.simQueue);
//            console.log(queueStr);
            $('#current').val(queueStr);
        },
        stopPool: function(){
            if(this.remote){
                this.remote.cancel();
            }
        },
        mainLoop: function(){

            if(this.simQueue.length > 0){
                var faceOffsets = this.simQueue.pop();
                this.currentFaceOffsets = faceOffsets;
                var facesString = genedice.Die.serializeFaceOffsets(faceOffsets);
//                console.log(facesString);
                this.log('SIMULATING:', facesString);
                this.runSimulation(facesString, 1024);
            } else {
                //breed
//                console.log(this.simResults);

                var fitnesses = _.map(this.simResults, function(result){return result.fitness;});
                var sortedResults = this.simResults.sort(function(a, b){return b.fitness - a.fitness;});//sort descending by fitness;
//                console.log(fitnesses);
                var fitnessesSorted = _.map(sortedResults, function(result){return result.fitness;});
//                console.log(fitnessesSorted);

                this.log('POOL FITNESSES:', fitnessesSorted.join(','));
                var getFitParent = function(){
                    var r = Math.random();
                    var i = Math.floor(r*r*r*sortedResults.length);
//                    console.log(i);
                    return sortedResults[i];
                }

                this.log('BREEDING NEW POOL');

                var newPool = [];
                for(var i = 0; i < this.poolSize; ++i){
                    var parentA = getFitParent();
                    var parentB = getFitParent();

                    var fitness = (parentA.fitness+parentB.fitness)*0.5;
//                    console.log('breeding', parentA, parentB);
                    //var mutatedA = genedice.Die.getValidMutatedOffsets(parentA.faceOffsets);
                    //var mutatedB = genedice.Die.getValidMutatedOffsets(parentB.faceOffsets);
                    var child = genedice.Die.getValidBredOffsets(parentA.faceOffsets, parentB.faceOffsets);
//                    console.log(child);
                    var mutatedChild = genedice.Die.getValidMutatedOffsets(child, 1 - fitness);//mutate less if we are close?
//                    console.log('breeding', mutatedChild);
                    newPool.push(mutatedChild);
                }


//                console.log(sortedResults);
                this.startPool(newPool);
                //start again!
                this.mainLoop();

            }
        },
        runSimulation: function(dieString, numSims){
            this.stopPool();
            var remote = this.remote = new genedice.RemoteSimulationJob();
            remote.init(dieString, numSims);
            remote.onSuccess.add(_.bind(this.simulationDone, this));
            remote.go();
        },
        simulationDone: function(status){
//            console.log('simulation done', status);
            var faceOffsets = this.currentFaceOffsets;
            var numFaces = faceOffsets.length;
            var totalResults = _.reduce(status, function(memo, num){return memo+num;}, 0);
//            console.log('recieved results ',totalResults);
            var probabilities = [];
            var counts = {};
            for(var i = 0; i < numFaces; ++i){
                var count = status[i] || 0;
                counts[i] = count;
                var prob = count/totalResults;
                probabilities.push(prob);
            }
            var result = {faceOffsets: this.currentFaceOffsets, probabilities: probabilities};
//            console.log(result);
            var fitness = this.getFitness(result);
            result.fitness = fitness;
//            console.log(fitness);
            this.log('SIMULATION RESULT:', fitness);
//            console.l
            this.simResults.push(result);

            this.mainLoop();
        },
        makeInitialPool: function(){
            var result = [];
            for(var i = 0; i < this.poolSize; ++i){
                result.push(genedice.Die.getRandomValidFaceOffsets(this.numSides));
            }
            return result;
        },
        parseRatioString: function(ratios){
            var parts = ratios.split(',');
            var numbers = _.map(parts, Number);
            var sum = _.reduce(numbers, function(memo, n){return memo + n}, 0);
            var div = 1/sum;
            var normalized = _.map(numbers, function(n){return n*div});
//            console.log(normalized);
            return normalized
        },
        getFitness: function(result){
            var probsSorted = result.probabilities.sort();
            var targetSorted = this.targetRatios.sort();
            var num = targetSorted.length;
            var sum2 = 0;
            var goodness = 1;
            for(var i = 0; i < num; ++i){
                var closeness = 1 - Math.abs(probsSorted[i] - targetSorted[i]);
                var c2 = closeness*closeness;
                //var d2 = diff*diff;
                goodness *= c2;
//                sum2 += d2;
            }
            //sum2 /= num;
            return goodness;

//            return 1 - sum2;
        },
        stop: function(){
            this.log('STOPPING EVOLUTION');
            this.stopPool();
        },
        log: function(){
            var args = Array.prototype.slice.call(arguments);
            var status = $('#status');
            status.val(status.val() + '> ' + args.join(' ') + "\n");
            status.scrollTop(9999999);
        }
    };



    genedice.Job = function(){
        this.onCancel = new genedice.Signal();
        this.onSuccess = new genedice.Signal();
        this.onFailure = new genedice.Signal();
        this.reset();
    };
    genedice.Job.prototype = {
        go: function(){
            if(!this.running){
                this.failed = false;
                this.running = true;
                this.completed = false;
                this.cancelled = false;
                this._go();
            }
        },
        _go: function(){},
        cancel: function(){
            if(!this.cancelled){
                this.cancelled = true;
                this._cancel();
                this.onCancel.trigger();
            }
        },
        _cancel: function(){},
        _success: function(){
//            console.log('job complete');
            if(this.completed){
                console.log('JOB IS ALREADY COMPLETE!');
            }
            if(!this.completed && this.running && !this.cancelled){
                var result = this.results = Array.prototype.slice.call(arguments);
//                console.log(this.results);
                this.completed = true;
                this.running = false;
                this.onSuccess.trigger.apply(this.onSuccess, result);
            }
        },
        _failure: function(){
            console.log('failure: ', this);
            if(this.running && !this.cancelled){
                this.results = Array.prototype.slice.call(arguments);
                this.failed = true;
                this.running = false;
                this.onFailure.trigger.apply(this.onFailure, this.results);
            }
        },
        reset: function(){
            this.failed = false;
            this.running = false;
            this.completed = false;
            this.cancelled = false;
        }
    };

    genedice.Signal = function(){
        this.listeners = [];
        this.addQueue = [];
        this.removeQueue = [];
    };
    genedice.Signal.prototype = {
        add: function(listener){
            this.addQueue.push(listener);
        },
        remove: function(listener){
            this.removeQueue.push(listener);
        },
        trigger: function(){
            var args = Array.prototype.slice.call(arguments);
            if(this.removeQueue.length > 0){
                var listeners = this.listeners;
                _.each(this.removeQueue, function(listener){
                    var index = _.indexOf(listeners, listener);
                    if(index != -1){
                        listeners.splice(index, 1);
                    }
                });
                this.removeQueue = [];
            }
            if(this.addQueue.length > 0){
                this.listeners = this.listeners.concat(this.addQueue);
                this.addQueue = [];
            }
            _.each(this.listeners, function(listener){
                listener.apply(null, args);
            });
        }
    };


    genedice.RemoteSimulator = function(){

    };
    genedice.RemoteSimulator.prototype = {
        init: function(){
            var thisURL = window.location.href;
            this.id = 'genedice_'+new Date().getTime()+'_'+Math.round(Math.random()*1000);
            this.callbackName = this.id;
            var params = {s: 1};
//            var params = {
//                d: this.dieString,
//                c: this.callbackName,
//                p: numThisTime
//            };
            params = $.param(params);
            var childURL = thisURL + '?' + params;
            var callback = _.bind(this.callback, this);

            window[this.callbackName] = callback;
            //for(var i = 0; i < 1; ++i){
//                $('body').create('iframe', '', {id: this.id, src: childURL, width: '512px', height: '512px'});
            //var newwindow = window.open(childURL,'genedice','toolbar=1,scrollbars=1,location=1,statusbar=0,menubar=1,resizable=1,width=512,height=512');

            //}
        },
        callback: function(){

        },
        send: function(){

        }
    };


    genedice.RemoteSimulationJob = function(){
        genedice.Job.apply(this);
    };
    genedice.RemoteSimulationJob.prototype = _.extend(new genedice.Job(), {
        init: function(dieString, numSims){
            this.dieString = dieString;
            this.numSims = numSims;
            this.numResults = 0;
            this.counts = {};
            this.faces = [];
        },
        _go: function(){
            var thisURL = window.location.href;
            this.id = 'genedice_'+new Date().getTime()+'_'+Math.round(Math.random()*1000);
            this.callbackName = this.id;
            var numLeft = this.numSims - this.numResults;
            var numThisTime = Math.min(numLeft, 256);
//            console.log('need '+numLeft + '. starting remote sim with ' + numThisTime);
            var params = {
                d: this.dieString,
                c: this.callbackName,
                p: numThisTime
            };
            params = $.param(params);
            var childURL = thisURL + '?' + params;
            var callback = _.bind(this.result, this);
//
            window[this.callbackName] = callback;
            var childWindow = this.childWindow = window.open(childURL,'genedice','toolbar=1,scrollbars=1,location=1,statusbar=0,menubar=0,titlebar=0,toolbar=0,resizable=1,width=512,height=512,left=0,top=0');
            childWindow.blur();

            var windowChecker = {
                job: this,
                target: childWindow,
                run: true,
                ping: function(){
                    if(!windowChecker.run) return;
                    if(!windowChecker.target.window){
                        windowChecker.stop();
                        windowChecker.job._go();
                    } else {
                        windowChecker.loop();
                    }
                },
                stop: function(){
                    windowChecker.run = false;
                },
                loop: function(){
                    setTimeout(windowChecker.ping, 1000);
                }
            };
            this.windowChecker = windowChecker;
            windowChecker.loop();
//            this.childWindow = window.open(childURL,'genedice2','toolbar=1,scrollbars=1,location=1,statusbar=0,menubar=1,resizable=1,width=512,height=512');

//            for(var i = 0; i < 1; ++i){
//                $('body').create('iframe', '', {id: this.id, src: childURL, width: '512px', height: '512px'});
//            }
        },
        _cancel: function(){
            this.tidyUp();
        },
        tidyUp: function(){
            if(this.id){
                if(this.childWindow){
                    this.windowChecker.stop();
                    this.windowChecker = null;
                    this.childWindow.close();//must do this or we leak!
                    this.childWindow = null;
                }
//                $('#'+this.id).remove();
                delete window[this.callbackName];
            }
        },
        result: function(status){
            //tidy up and notify listeners
//            console.log('got callback', status);
            var faces = status.faces || [];
            this.faces = this.faces.concat(faces);
            if(this.faces.length > this.numSims){
                this.faces = this.faces.slice(0, this.numSims);
            }
            this.numResults = this.faces.length;
            this.tidyUp();
            if(this.numResults >= this.numSims){
                _.each(this.faces, function(f){
//                    if(this.numResults < this.numSims){
                    this.counts[f] = 1 + (this.counts[f]||0);
//                        this.numResults += 1;
//                    }
                }, this);
//                console.log(this.counts);
                this._success(this.counts);
            } else {
                this.reset();
                this.go();
            }
        }
    });




    genedice.Die = function(){
    };
    genedice.Die.prototype = {
        buildRandomDieGeometry: function(){
            var faceOffsets = genedice.Die.getRandomValidFaceOffsets(11);
            var csg = this.buildCSGFromFaceOffsets(faceOffsets);
//            console.log(this.serializeFaceOffsets(faceOffsets));
            this.csg = csg;
            this.faceOffsets = faceOffsets;
            this.polygons = csg.toPolygons();
            this.comOffset = vec3.create([0, 0, 0]);

        },
        buildDieGeometryFromString: function(dieString){
            var faceOffsets = genedice.Die.deserializeFaceOffsets(dieString);

            var csg = genedice.Die.buildCSGFromFaceOffsets(faceOffsets);
//
//            console.log(this.serializeFaceOffsets(faceOffsets));
            this.csg = csg;
            this.faceOffsets = faceOffsets;
            this.polygons = csg.toPolygons();
            this.comOffset = vec3.create([0, 0, 0]);

        },
        getGLUGeometry: function(gl){
            var polygons = this.polygons;
            var vertexArray = [];
            // var texArray = [];
            var colorArray = [];
            var indexArray = [];
            var comOffset = this.comOffset;

            var numPolys = polygons.length;
            for(var p = 0; p < numPolys; ++p){
                var polygon = polygons[p];
                var numVertices = polygon.vertices.length;
                var iStart = vertexArray.length/3;
                var color = polygon.shared;

//                for(var j = 0; j < 3; ++j){
//                    color.push(Math.random());
//                }
//                color.push(1);

                for(var v = 0; v < numVertices; ++v){
                    var vertex = polygon.vertices[v];
                    vertexArray.push(vertex.pos.x+comOffset[0], vertex.pos.y+comOffset[1], vertex.pos.z+comOffset[2]);
                    // for(var j = 0; j < 2; ++j){
                        // texArray.push(0);
                        //                    texArray.push(Math.random());
                    // }
//                    var r = Math.sin(vertex.pos.x*130)*0.5 + 0.5;
//                    var g = Math.sin(vertex.pos.y*211)*0.5 + 0.5;
//                    var b = Math.sin(vertex.pos.z*173)*0.5 + 0.5;
//                    var a = 1;
//                    color = [r, g, b, a];
//                    color = [Math.random(), Math.random(), Math.random(), 1];
                    colorArray = colorArray.concat(color);
                }
                for(var i = 2; i < numVertices; ++i){
                    indexArray.push(iStart, iStart+i-1, iStart+i);
                }
            }
            var result = new GLU.Geometry(gl);
            result.makeFromArrays(indexArray, vertexArray, 'aVertexPosition', null, null, colorArray, 'aColor');
            return result;
        },
        getBulletShapes: function(){
            var polygons = this.polygons;
            var comOffset = this.comOffset;

            var dieMesh = new Ammo.btTriangleMesh();
            var hullShape= new Ammo.btConvexHullShape();

            var numPolys = polygons.length;
            for(var p = 0; p < numPolys; ++p){
                var polygon = polygons[p];
                var numVertices = polygon.vertices.length;

                for(var i = 2; i < numVertices; ++i){
                    var indices = [0, i-1, i];
                    var vectors = _.map(indices, function(index){
                        var vertex = polygon.vertices[index];
                        return new Ammo.btVector3(vertex.pos.x+comOffset[0], vertex.pos.y+comOffset[1], vertex.pos.z+comOffset[2]);
                    });
                    dieMesh.addTriangle(vectors[0], vectors[1], vectors[2], false);
                }

                _.each(polygon.vertices, function(vertex){
                    hullShape.addPoint(new Ammo.btVector3(vertex.pos.x+comOffset[0], vertex.pos.y+comOffset[1], vertex.pos.z+comOffset[2]));
                });
            }

            var meshShape = new Ammo.btConvexTriangleMeshShape(dieMesh, true);

            var inertia = new Ammo.btVector3(0, 0, 0);
            meshShape.calculateLocalInertia(1, inertia);
            var compoundShape = new Ammo.btCompoundShape();

            var principal = genedice.Die.getPrincipal(meshShape);
            var rotation = principal.getRotation();
//            console.log(inertia.x(), inertia.y(), inertia.z());
//            console.log(rotation.x(), rotation.y(), rotation.z(), rotation.w());
            var childTransform = principal.inverse();
            compoundShape.addChildShape(childTransform, meshShape);

            return {mesh: meshShape, hull: hullShape, compound: compoundShape, inertia: inertia};
        }
    };
    _.extend(genedice.Die, {
        randomVec: function(length){
            length = length==undefined?1:length;

            var len;
            var vec = vec3.create();
            var triesLeft = 8;
            do{
                vec3.set(
                    [
                        (Math.random()-0.5)*2,
                        (Math.random()-0.5)*2,
                        (Math.random()-0.5)*2
                    ],
                    vec
                );
                len = vec3.length(vec);
            } while((len ==0 || len > 1) && --triesLeft >= 0);
            vec3.scale(vec, length/len);
            return vec;
        },
        mutateVec: function(vec, a, r){
            //a is how far to vary round sphere
            //r is how much to vary radius

            var l = vec3.length(vec);
            var axis1 = genedice.Die.getAPerpendicularVector(vec);
            var axis2 = vec3.cross(axis1, vec, vec3.create());
            vec3.normalize(axis1);
            vec3.normalize(axis2);
            vec3.scale(axis1, l);
            vec3.scale(axis2, l);

            var move = Math.random();
            move = move*move*a;

            var axis1Component = vec3.create();
            var axis2Component = vec3.create();
            var theta = Math.random()*2*Math.PI;
            vec3.scale(axis1, Math.cos(theta)*move, axis1Component);
            vec3.scale(axis2, Math.sin(theta)*move, axis2Component);
            var newR = (Math.random()-0.5)*r*2 + l;
            newR = Math.max(newR, 0.5);
            newR = Math.min(newR, 1.5);

            var result = vec3.create(vec);
//            console.log(vec3.str(axis1Component));
            vec3.add(result, axis1Component);
            vec3.add(result, axis2Component);
            vec3.normalize(result);
            vec3.scale(result, newR);

//            console.log(vec3.str(result));
            return result;
        },
        blendVecs: function(vec1, vec2, p){
            return vec3.lerp(vec1, vec2, p, vec3.create());
        },
        isValidFaceOffsetSet: function(faceOffsets){
            var csg = genedice.Die.buildCSGFromFaceOffsets(faceOffsets);
            return !!csg;
        },
        search: function(builder, condition){
            var searching = true;
            var attempts = 0;
            while(true){
                var attempt = builder();
                var isValid = condition(attempt);
                if(isValid){
                    break;
                }
                ++attempts;
            }
//            console.log(attempts + ' attempts');
            return attempt;
        },
        getRandomValidFaceOffsets: function(numSides){
            var builder = function(){
                var faceOffsets = [];
                for(var i = 0; i < numSides; ++i){
                    faceOffsets.push(genedice.Die.randomVec(1));
                }
                return faceOffsets;
            };
            var condition = genedice.Die.isValidFaceOffsetSet;
            var satisfying = genedice.Die.search(builder, condition);
            return satisfying;
        },
        getValidMutatedOffsets: function(faceOffsets, mutationAmount){
            mutationAmount = mutationAmount || 1;
            var builder = function(){
                return _.map(faceOffsets, function(faceOffset){
                    return genedice.Die.mutateVec(faceOffset, mutationAmount*0.1, mutationAmount*0.1);
                });
            };
            var condition = genedice.Die.isValidFaceOffsetSet;
            var satisfying = genedice.Die.search(builder, condition);
            return satisfying;
        },
        getValidBredOffsets: function(faceOffsetsA, faceOffsetsB){
            var builder = function(){
                return _.map(faceOffsetsA, function(faceOffset, i){
                    return genedice.Die.blendVecs(faceOffset, faceOffsetsB[i], Math.random());
                });
            };
            var condition = genedice.Die.isValidFaceOffsetSet;
            var satisfying = genedice.Die.search(builder, condition);
            return satisfying;
        },
        buildCSGFromFaceOffsets: function(faceOffsets){
            //vec3[] faceOffsets  describes face normal directions AND distance from center. max distance is 1
            var baseSize = 4;//start with a giant cube and carve away
            var csg = CSG.cube({center: [0, 0, 0], radius: baseSize});
            var numSides= faceOffsets.length;
            for(var i = 0; i < numSides; ++i){
                var offset = faceOffsets[i];
                var normalized = vec3.normalize(offset, vec3.create());
//                console.log(offset);

                var direction = vec3.normalize(offset, vec3.create());
                var length = vec3.length(offset);
                var slice = this.makeCSGTetrahedron(direction, 50, 50, -length);
                var phase = i/(numSides-1);
//                slice.setColor(1, 0, 0, 1);
                var r = Math.abs(normalized[0]);
                var g = Math.abs(normalized[1]);
                var b = Math.abs(normalized[2]);
                // var r = normalized[0]*0.6+0.6;
                // var g = normalized[1]*0.6+0.6;
                // var b = normalized[2]*0.6+0.6;
                slice.setColor(r, g, b, 1);
//                slice.setColor(0, phase, 1-phase, 1);
                csg = csg.intersect(slice);
            }
//            this.csg = shape;
            var numCSGPolygons= csg.polygons.length;//number of polygons in resulting csg shape
            //do we have the correct number of faces?
            //some configurations of facesoffsets may give us a cylindrical shape not cut away fully at the base shape
            //that would not be suitable
            var hasCorrectNumberOfPolygons = numCSGPolygons == numSides;

            var maxLength = 0;
            _.each(csg.polygons, function(polygon){
                _.each(csg.vertices, function(vertex){
                    maxLength = Math.max(maxLength, vertex.pos.length());
                });
            });
            var maxCSGExtent = maxLength;//distance of furthest vertex

            //if we have not carved away fully at the base shape we will have very some very far vertices
            //this should only really happen if we also have a bad number of polygons (or a vertex exactly at the limit)
            //treat this as a bad configuration also
            var isNotTooBig = maxLength < baseSize;

            var isValidDie = isNotTooBig && hasCorrectNumberOfPolygons;

            return isValidDie ? csg : null;
        },
        makeCubeFaceOffsets: function(){
            var result = [];
            for(var i = 0; i < 3; ++i){
                var vec = vec3.create([i==0?1:0,i==1?1:0,i==2?1:0]);
//                var vec = vec3.create([Math.random(), Math.random(), Math.random()]);
//                vec3.scale(vec, 0.1 + Math.random()*2);
                result.push(vec);
                var vec2 = vec3.scale(vec, -1, vec3.create());
                result.push(vec2);
            }
//            console.log(result);
            return result;
        },
        makeRotatedCubeFaceOffsets: function(){
            var mat = mat4.identity(mat4.create());
//            mat = mat4.rotateY(mat, Math.PI/4);
            var result = [];
//            var sizes = [2, 0.3, 0.3];
            var sizes = [1, 1, 1];
            for(var i = 0; i < 3; ++i){
                var vec = vec3.create([i==0?1:0,i==1?1:0,i==2?1:0]);
                //                var vec = vec3.create([Math.random(), Math.random(), Math.random()]);
                vec3.scale(vec, sizes[i]);
                vec = mat4.multiplyVec3(mat, vec);
                result.push(vec);
                var vec2 = vec3.scale(vec, -1, vec3.create());
                result.push(vec2);
            }
//            console.log(result);
            return result;
        },
        serializeFaceOffsets: function(faceoffsets){
            var all = [];//Array.prototype.concat.apply([], faceoffsets);
            _.each(faceoffsets, function(f){
                all.push(f[0], f[1], f[2]);
            });
            return all.join(',');
//            console.log(all);
        },
        deserializeFaceOffsets: function(str){
//            console.log(str);
            var parts = str.split(',');
            var max = parts.length;
            var result = [];
            for(var i = 0; i < max; i+= 3){
                result.push(vec3.create(parts.slice(i, i+3)));
            }
            return result;
        },
        serializeOffsetGroup: function(array){
            var all = _.map(array, function(a){return genedice.Die.serializeFaceOffsets(a);});
            return all.join(';');
        },
        deserializeOffsetGroup: function(str){
            var parts = str.split(';');
            return _.map(parts, genedice.Die.deserializeFaceOffsets);
        },
        getPrincipal: function(meshShape){
            var principal = new Ammo.btTransform();
            var inertia = new Ammo.btVector3(0, 0, 0);
            var volume = 0;
            meshShape.calculateLocalInertia(1, inertia);
            meshShape.calculatePrincipalAxisTransform(principal, inertia, volume);
            return principal;
        },
        getCOM: function(meshShape){
            //var principal = new Ammo.btTransform();
            //var inertia = new Ammo.btVector3(0, 0, 0);
            //var volume = 0;
            //meshShape.calculateLocalInertia(1, inertia);
//            console.log(inertia.x(), inertia.y(), inertia.z());
            //meshShape.calculatePrincipalAxisTransform(principal, inertia, volume);
//            principal = principal.inverse();
            var principal = this.getPrincipal(meshShape);
            var origin = principal.getOrigin();
//            var rotation = principal.getRotation();
            //var basis = new Ammo.btQuaternion();
            //principal.getBasis().getRotation(basis);
            //console.log(basis.x(), basis.y(), basis.z(), basis.w());
//            console.log(rotation.x(), rotation.y(), rotation.z(), rotation.w());
//            var a = [];
//            for(var i = 0; i < 16; ++i){
//                a.push(0);
//            }
//            principal.getOpenGLMatrix(a);
//            console.log(a);
//            console.log(inertia.x(), inertia.y(), inertia.z());
//            console.log(origin.x(), origin.y(), origin.z());
//            console.log(Ammo);
            return vec3.create([origin.x(), origin.y(), origin.z()]);
        },
        getNorm: function (a, b, c){
            var ab = vec3.subtract(b, a, vec3.create());//b.minus(a);
            var ac = vec3.subtract(c, a, vec3.create());//c.minus(a);
            return vec3.cross(ac, ab, vec3.create());//ac.cross(ab);
        },
        getAPerpendicularVector: function(a){
            var axis;
            for(var i = 0; i < 3; ++i){
                axis = vec3.create([i==0?1:0, i==1?1:0, i==2?1:0]);
                if(Math.abs(vec3.dot(a, axis)) < 0.9){
                    break;
                }
            }
            return vec3.cross(a, axis, vec3.create());
        },
        makeCSGTetrahedron: function(direction, height, width, offset){
            var forward = direction;
            var side = this.getAPerpendicularVector(forward);
            var up = vec3.cross(side, forward, vec3.create());
            vec3.scale(side, width);
            vec3.scale(up, width);
            var offsetz = 0 + offset;//-height*0.25;

            var front = vec3.scale(forward, height+offsetz, vec3.create());
            var others = [];
            var upComponent = vec3.create();
            var sideComponent= vec3.create();
            var forwardComponent = vec3.create();
            for(var i = 0; i < 3; ++i){
                var theta = Math.PI*i*2/3;
                var vec = vec3.create();
                vec3.scale(up, Math.cos(theta), upComponent);
                vec3.scale(side, Math.sin(theta), sideComponent);
                vec3.scale(forward, offsetz, forwardComponent);
                vec3.add(vec, upComponent);
                vec3.add(vec, sideComponent);
                vec3.add(vec, forwardComponent);
                others.push(vec)
            }
            var bottom = others[0];
            var left = others[1];
            var right = others[2];
            var faces = [
                [front, right, bottom],
                [bottom, left, front],
                [left, bottom, right],
                [right, front, left]
            ];
            var polys = [];
            for(var f = 0; f < faces.length; ++f){
                var face = faces[f];
                var norm = this.vec3ToCSG(this.getNorm(face[0], face[1], face[2]));
                polys.push(new CSG.Polygon(_.map(face, function(vertex){
                    return new CSG.Vertex(this.vec3ToCSG(vertex), this.vec3ToCSG(norm));
                }, this)));
            }
            return CSG.fromPolygons(polys);
        },
        vec3ToCSG: function(v){
            return new CSG.Vector(v[0], v[1], v[2]);
        }
    });


    genedice.Simulation = function(){
    };
    genedice.Simulation.prototype = {
        container: null,
        canvas: null,
        gl: null,
        mouseX: 0, mouseY: 0,

        physics: {},
        graphics: {},
        die: null,

        mvMatrix: mat4.create(),
        mvMatrixStack: [],
        pMatrix: mat4.create(),

        uMVMatrix: null, uPMatrix: null, uColor: null,

        init: function(dieString, callbackName, parallelDie){
//            parallelDie = Math.min(parallelDie, 64);
            this.parallelDie = parallelDie;
            this.callbackName = callbackName;
            this.container = document.getElementById('container');
            this.canvas = document.getElementById('canvas');

            this.stats = new Stats();
            this.stats.getDomElement().style.position = 'absolute';
            this.stats.getDomElement().style.top = '0px';

            this.container.appendChild( this.stats.getDomElement() );

            this.initGL(this.canvas);
            var gl = this.gl;
            this.updateSize();
            var gluProgram = new GLU.Program(
                gl,
                [new GLU.Shader(gl, 'shader-fs-solid'), new GLU.Shader(gl, 'shader-vs-solid')],//shaders
                ['aVertexPosition', 'aColor'],//attributes
                ['uMVMatrix', 'uPMatrix', 'uColor']//uniforms
            );
            var gluProgramCheckered = new GLU.Program(
                gl,
                [new GLU.Shader(gl, 'shader-fs-checker'), new GLU.Shader(gl, 'shader-vs-checker')],//shaders
                ['aVertexPosition', 'aColor'],//attributes
                ['uMVMatrix', 'uPMatrix', 'uColor']//uniforms
            );

            var gluMaterial = new GLU.Material(gl, gluProgram);
            var gluMaterialCheckered = new GLU.Material(gl, gluProgramCheckered);
            var graphics = this.graphics;
            this.die = new genedice.Die();
            if(dieString){
                this.die.buildDieGeometryFromString(dieString);
            } else {
                this.die.buildRandomDieGeometry();
            }
            graphics.dieGeometry = this.die.getGLUGeometry(gl);

            graphics.groundGeometry = new GLU.Geometry(gl);
            graphics.groundGeometry.makeRect(200, 200);

            this.uMVMatrix = new GLU.Uniform(gl, 'uMVMatrix', 'Matrix4fv', {matrix: this.mvMatrix, transpose: false}, ['transpose', 'matrix']);
            this.uPMatrix = new GLU.Uniform(gl, 'uPMatrix', 'Matrix4fv', {matrix: this.pMatrix, transpose: false}, ['transpose', 'matrix']);
            this.uColor = new GLU.Uniform(gl, 'uColor', '4fv', {color: new Float32Array([1.0, 1.0, 1.0, 1.0])}, ['color']);

            graphics.dieObject = new GLU.Object(gl, graphics.dieGeometry, gluMaterial, [this.uMVMatrix, this.uPMatrix, this.uColor]);
            graphics.groundObject = new GLU.Object(gl, graphics.groundGeometry, gluMaterialCheckered, [this.uMVMatrix, this.uPMatrix, this.uColor]);

//            console.log(graphics.dieObject);



            this.initPhysics();
            this.initDiePosition();

            this.mouseDelegate =  _.bind(function(e) {
                this.mouseX = e.pageX/this.canvas.width - 0.5;
                this.mouseY = e.pageY/this.canvas.height - 0.5;
            }, this);

            $(document).bind('mousemove', this.mouseDelegate);
            this.updateDelegate = _.bind(this.update, this);

        },

        initPhysics: function(){

            var sleepLinear = 0.01;
            var sleepAngles = 0.01;
            var physics = this.physics;
            var noGroup = 0x0;
            var wallsGroup = 0x1;
            var dieGroup = 0x2;

            physics.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            physics.dispatcher = new Ammo.btCollisionDispatcher(physics.collisionConfiguration);
            physics.overlappingPairCache = new Ammo.btDbvtBroadphase();
            physics.solver = new Ammo.btSequentialImpulseConstraintSolver();
            physics.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(physics.dispatcher, physics.overlappingPairCache, physics.solver, physics.collisionConfiguration);
            physics.dynamicsWorld.setGravity(new Ammo.btVector3(0, -30, 0));
            physics.bodies = [];

            physics.groundShape = new Ammo.btBoxShape(new Ammo.btVector3(100, 50, 100));
            physics.groundTransform = new Ammo.btTransform();
            physics.groundTransform.setIdentity();
            physics.groundTransform.setOrigin(new Ammo.btVector3(0, -50, 0));
            var mass = 0;
            var localInertia = new Ammo.btVector3(0, 0, 0);
            var myMotionState = new Ammo.btDefaultMotionState(physics.groundTransform);
            var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, physics.groundShape, localInertia);
            physics.groundBody = new Ammo.btRigidBody(rbInfo);
            physics.groundBody.setFriction(0.5);
            physics.groundBody.setRestitution(0.7);
            physics.groundBody.setSleepingThresholds(sleepLinear, sleepAngles);
            physics.dynamicsWorld.addRigidBody(physics.groundBody, wallsGroup, dieGroup);
            physics.bodies.push(physics.groundBody);


    //        physics.dieMesh = new Ammo.btTriangleMesh();
    //        physics.dieShape = new Ammo.btConvexTriangleMeshShape(physics.dieMesh);
    //        physics.dieShape = new Ammo.btBoxShape(new Ammo.btVector3(1, 1, 1));
            var dieShapes = this.die.getBulletShapes();
            physics.dieShape = dieShapes.hull;
            var startTransform = new Ammo.btTransform();
            startTransform.setIdentity();
            var mass = 1;
            var localInertia = dieShapes.inertia;
    //        var localInertia = new Ammo.btVector3(0, 0, 0);
    //        physics.dieShape.calculateLocalInertia(mass, localInertia);
    //        console.log(localInertia.x(), localInertia.y(), localInertia.z());


            physics.dies = [];
            physics.activeDies = {};
            physics.inactiveDies = [];
            for(var i = 0; i < this.parallelDie; ++i){

                var myMotionState = new Ammo.btDefaultMotionState(startTransform);
                var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, physics.dieShape, localInertia);
                var dieBody = new Ammo.btRigidBody(rbInfo);
                dieBody.setRestitution(0.7);
                dieBody.setFriction(0.5);
                dieBody.setSleepingThresholds(sleepLinear, sleepAngles);
                //        console.log(physics.dieBody.getRestitution());
                var diePosition = {
                    position: vec3.create(),
                    rotation: quat4.create(),
                    transform: new Ammo.btTransform()// taking this out of readBulletObject reduces the leaking
                }

                physics.dynamicsWorld.addRigidBody(dieBody, dieGroup, wallsGroup);
                physics.bodies.push(dieBody);
                var dieData = {id: i, body: dieBody, position: diePosition};
                physics.dies.push(dieData);
                physics.activeDies[i] = dieData;
            }


        },

        initDiePosition: function(){
            var physics = this.physics;
            var dies = physics.dies;
            for(var i = 0; i < dies.length; ++i){
//                console.log(i);
                var die = dies[i];
                var dieBody = die.body;
                var transform = dieBody.getWorldTransform();
                var origin = new Ammo.btVector3();
                origin.setX((Math.random()-0.5)*100);
                origin.setY(50 - Math.random()*20);
                origin.setZ((Math.random()-0.5)*100);
                transform.setOrigin(origin);
//                                  console.log(origin.getX());
        //        randomly rotate the object
                var axis = genedice.Die.randomVec();
                var angle = Math.random()*Math.PI*2;
                var rotation = new Ammo.btQuaternion();
                rotation.setRotation(new Ammo.btVector3(axis[0], axis[1], axis[2]), angle);
                transform.setRotation(rotation);


        //        var origin = transform.getOrigin();
        //        var rotation = transform.getRotation();
        ////        console.log(axis);
        //        rotation.setX(axis[0]);
        //        rotation.setY(axis[1]);
        //        rotation.setZ(axis[2]);
        //        rotation.setW(angle);
        //        console.log(rotation.getW());
                dieBody.activate();

        //        spin the object to start
    //            var torque = new genedice.Die().randomVec();
    //            torque = vec3.scale(torque, Math.random());
    //            console.log(vec3.str(torque));
    //            physics.dieBody.applyTorque(new Ammo.btVector3(torque[0], torque[1], torque[2]))
            }

        },

        readBulletObject: function(body, pos, quat, transform) {
            body.getMotionState().getWorldTransform(transform);
            var origin = transform.getOrigin();
            pos[0] = origin.x();
            pos[1] = origin.y();
            pos[2] = origin.z();
            var rotation = transform.getRotation();
    //        console.log(rotation.getX(), rotation.getY(), rotation.getZ(), rotation.getW());
            quat[0] = rotation.x();
            quat[1] = rotation.y();
            quat[2] = rotation.z();
            quat[3] = rotation.w();
        },

        isDieActive: function(i) {
            return this.physics.dies[i].body.isActive();
        },

        // Main demo code
        simTime: 0,
        simulate: function(dt) {
            var physics = this.physics;
            physics.dynamicsWorld.stepSimulation(dt, 10);
            this.simTime += dt;

        },

        initGL: function(canvas) {
            try {
                this.gl = canvas.getContext("experimental-webgl");
                var getExt = this.gl.getExtension("OES_texture_float");//we use this for float textures
                this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
                this.gl.enable(this.gl.DEPTH_TEST);

            } catch (e) {
            }
            if (!this.gl) {
                alert("Could not initialise WebGL, sorry :-(");
            }
        },


        updateSize: function(){
            var w = $(window).width();
            var h = $(window).height();
            w = Math.max(w, 128);
            h = Math.max(h, 64);
            this.gl.viewportWidth = this.canvas.width = w;
            this.gl.viewportHeight = this.canvas.height = h;
        },


        mvPushMatrix: function() {
            var copy = mat4.create();
            mat4.set(this.mvMatrix, copy);
            this.mvMatrixStack.push(copy);
        },

        mvPopMatrix: function() {
            if (this.mvMatrixStack.length == 0) {
                throw "Invalid popMatrix!";
            }
            this.mvMatrix = this.mvMatrixStack.pop();
        },

        shouldUpdate: true,
        updateDelegate: null,
        update: function() {
            if(!this.shouldUpdate) return;
            requestAnimationFrame( this.updateDelegate );

            this.updateSize();
            var speed = 1;
            for(var i = 0; i < speed; ++i){
                this.simulate(0.016);
            }
            this.render();
            this.stats.update();


            var activeDies = this.physics.activeDies;
            var inactiveDies = this.physics.inactiveDies;
            var stoppedDies = [];
            for(var id in activeDies){
                if(!this.isDieActive(id)){
                    stoppedDies.push(id);
                }
            }

            var numStopped = stoppedDies.length;
            for(var i = 0; i < numStopped; ++i){
                var id = stoppedDies[i];
                inactiveDies.push(activeDies[id]);
                delete activeDies[id];
            }

            if(inactiveDies.length >= this.physics.dies.length){
                this.shouldUpdate = false;
//                console.log('dies all stopped');
            } else if(this.simTime >= 20){
                this.shouldUpdate = false;
//                console.log('took too long, stop now!');
            }

            if(!this.shouldUpdate){
                this.done();
            }
        },

        readDieTransform: function(i){
            this.readBulletObject(this.physics.dies[i].body, this.physics.dies[i].position.position, this.physics.dies[i].position.rotation, this.physics.dies[i].position.transform);
        },
        getDieRotationMatrix: function(i){
            return quat4.toMat4(this.physics.dies[i].position.rotation);
        },

        render: function() {
            var mx = this.mouseX;///canvas.width;
            var my = this.mouseY;///canvas.height;

            var gl = this.gl;
            var physics = this.physics;
            var graphics = this.graphics;
            var time = (new Date()).getTime()*0.001;
            gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
            gl.clearColor(0.9, 0.9, 0.9, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, this.pMatrix);
            mat4.identity(this.mvMatrix);
            mat4.translate(this.mvMatrix, [0.0, 0.0, -0.5]);

            this.mvPushMatrix();

            mat4.scale(this.mvMatrix, [0.005, 0.005, 0.005]);//make make everything a bit smaller

            mat4.rotate(this.mvMatrix, (my*0.5+0.25)*Math.PI, [1, 0, 0]);//some mouse rotation
            mat4.rotate(this.mvMatrix, mx*Math.PI*2, [0, 1, 0]);//some mouse rotation

            var dies = this.physics.dies;
            var max = dies.length;
            this.uPMatrix.matrix = this.pMatrix;
            graphics.dieObject.bind();
            for(var i = 0; i < max; ++i){

                this.mvPushMatrix();
                this.readDieTransform(i);

                mat4.translate(this.mvMatrix, dies[i].position.position);//move the object
                var rMatrix = this.getDieRotationMatrix(i);
                mat4.multiply(this.mvMatrix, rMatrix);

                this.uMVMatrix.matrix = this.mvMatrix;

                graphics.dieObject.updateUniform(this.uMVMatrix);
                graphics.dieObject.draw();

                this.mvPopMatrix();
            }
            graphics.dieObject.unbind();

            this.mvPushMatrix();

            mat4.rotate(this.mvMatrix, -Math.PI/2, [1, 0, 0]);

            this.uMVMatrix.matrix = this.mvMatrix;
            this.uPMatrix.matrix = this.pMatrix;

            graphics.groundObject.bind();
            graphics.groundObject.draw();
            graphics.groundObject.unbind();

            this.mvPopMatrix();

            this.mvPopMatrix();
        },
        done: function(){

            $(document).unbind('mousemove', this.mouseDelegate);
            this.stats.unbind();
            //check which face is down
            var dies = this.physics.inactiveDies;
            var num = dies.length;
            var faceOffsets = this.die.faceOffsets;
            var transformed = vec3.create();
            var down = vec3.create([0, 1, 0]);
            var downFaces = [];
            for(var i = 0; i < num; ++i){
                var dieData = dies[i];
                var id = dieData.id;

                this.readDieTransform(id);
                var rotation = this.getDieRotationMatrix(id);
                var maxDot = 0;
                var downFace = -1;
                _.each(faceOffsets, function(faceOffset, i){
                    mat4.multiplyVec3(rotation, faceOffset, transformed);
                    var dot = vec3.dot(transformed, down)/vec3.length(transformed);
                    if(dot > maxDot){
                        maxDot = dot;
                        downFace = i
                    }
                });
                if(Math.abs(maxDot - 1) < 0.01){
                    //ok it is certainly facing down!
                    downFaces.push(downFace);
                }
            }

            var counts = {};
            _.each(downFaces, function(face, i){
                if(!counts[face]){
                    counts[face] = 1;
                } else {
                    counts[face] += 1;
                }
            });
            var status = {counts: counts, faces: downFaces};
            var parent = window.opener || window.parent;
            parent[this.callbackName](status);
        }
    };

    // Set the color of all polygons in a CSG solid
    CSG.prototype.setColor = function(r, g, b, a) {
        this.toPolygons().map(function(polygon) {
            polygon.shared = [r, g, b, a];
        });
    };

})(this);