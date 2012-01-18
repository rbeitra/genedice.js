var GLU = {}

GLU.Error = {
	GLU_SHADER_ERROR: 'GLU_SHADER_ERROR',
	GLU_PROGRAM_ERROR: 'GLU_PROGRAM_ERROR',
	GLU_UNKNOWN_ERROR: 'GLU_UNKNOWN_ERROR'
}



GLU.Core = function(gl){
	this.gl = gl;
}



GLU.Uniform = function(gl, uniformName, type, data, positions){
	GLU.Core.apply(this, [gl]);

	data = data || {};
	positions = positions || [];
	this.uniformName = uniformName;
	this.type = type;
	this.positions = positions;
	this.bindFunctionName = 'uniform'+this.type;
	this.bindFunction = this.gl[this.bindFunctionName];
	this.array = [null].concat(data);

	for(var s in data){
		this[s] = data[s];
	}
}
GLU.Uniform.prototype = {
	bind: function(program){
		this.array[0] = program[this.uniformName];
		for(var i = 0; i < this.positions.length; ++i){
			this.array[i+1] = this[this.positions[i]];
		}
		this.bindFunction.apply(this.gl, this.array);
	}
}



GLU.Shader = function(gl, id, shaderString, isVertex){
	GLU.Core.apply(this, [gl]);


	if(id){
		//an id was supplied so look for script contents
		shaderScript = document.getElementById(id);
	    if (!shaderScript) {
	    	throw {
	    		name: GLU.Error.GLU_SHADER_ERROR,
	    		message: 'Shader script element does not exist'
	    	}
	    }
	    var str = "";
	    var k = shaderScript.firstChild;
	    while (k) {
	        if (k.nodeType == 3) {
	            str += k.textContent;
	        }
	        k = k.nextSibling;
	    }

	    shaderString = str;

	    if (shaderScript.type == "x-shader/x-fragment") {
	    	isVertex = false;
	    } else if (shaderScript.type == "x-shader/x-vertex") {
	    	isVertex = true;
	    } else {
	    	throw {
	    		name: GLU.Error.GLU_SHADER_ERROR,
	    		message: 'Shader script type does not match'
	    	}
	    }

	} else {
		//we were supplied with a string
		if(!shaderString){
	    	throw {
	    		name: GLU.Error.GLU_SHADER_ERROR,
	    		message: 'Shader script is not defined'
	    	}
		}
	}
	
    var shader = gl.createShader(isVertex?gl.VERTEX_SHADER:gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, shaderString);
    gl.compileShader(shader);
	var typeString = isVertex?'vertex':'fragment';
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    	var log = gl.getShaderInfoLog(shader);
	    	throw {
	    		name: GLU.Error.GLU_SHADER_ERROR,
	    		message: 'Shader compile error: ' + log,
	    		type: typeString,
	    		log: log
	    	}
    }

    this.shader = shader;
}



GLU.Program = function(gl, shaders, attributes, uniforms) {
	GLU.Core.apply(this, [gl]);

    attributes = attributes || [];
    uniforms = uniforms || [];
    shaders = shaders || [];

    var shaderProgram = gl.createProgram();

    this.program = shaderProgram;

    for(var i = 0; i < shaders.length; ++i){
        var shader = shaders[i];
        gl.attachShader(shaderProgram, shader.shader);
    }
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        // console.log("Could not initialise shaders");
    	throw {
    		name: GLU.Error.GLU_PROGRAM_ERROR,
    		message: "Could not initialise shaders"
    	}
    }

    gl.useProgram(shaderProgram);

    for(var i = 0; i < attributes.length; ++i){
        this.setupAttribute(attributes[i]);
    }
    for(var i = 0; i < uniforms.length; ++i){
        this.setupUniform(uniforms[i]);
    }
}
GLU.Program.prototype = {
	bind: function(){
		this.gl.useProgram(this.program);
	},
	setupAttribute: function(attributeName){
        var extName = attributeName;// + 'Attribute';
        var id = this.gl.getAttribLocation(this.program, attributeName);
        this[extName] = id;
        this.gl.enableVertexAttribArray(id);
    },
    setupUniform: function(uniformName){
        var extName = uniformName;// + "Uniform";
        var id = this.gl.getUniformLocation(this.program, uniformName);
        this[extName] = id;
    }
}



GLU.Buffer = function(gl, mode, dataType, itemSize, drawMode){
	GLU.Core.apply(this, [gl]);

	this.mode = mode || this.gl.ARRAY_BUFFER;
	this.dataType = dataType || this.gl.FLOAT;
	this.itemSize = itemSize || 1;
	this.drawMode = drawMode || this.gl.STATIC_DRAW;

	this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.mode, this.buffer);

    this.gl.bindBuffer(this.mode, null);
    this.length = 0;

}
GLU.Buffer.prototype = {
	bind: function(){
		this.gl.bindBuffer(this.mode, this.buffer);
	},
	unbind: function(){
		this.gl.bindBuffer(this.mode, null);
	},
	setArray: function(array){
	    this.setData(this.arrayToTypedArray(array, this.dataType));
	},
	setData: function(data){
		this.bind();
	    this.gl.bufferData(this.mode, data, this.drawMode);
	    this.length = data.length;
		this.unbind();
	},
	arrayToTypedArray: function(array, type){
		var data;
		switch(this.dataType){
			case this.gl.BYTE:
				data = new Int8Array(array);
				break;
			case this.gl.UNSIGNED_BYTE:
				data = new Uint8Array(array);
				break;
			case this.gl.SHORT:
				data = new Int16Array(array);
				break;
			case this.gl.UNSIGNED_SHORT:
				data = new Uint16Array(array);
				break;
			case this.gl.INT:
				data = new Int32Array(array);
				break;
			case this.gl.UNSIGNED_INT:
				data = new Uint32Array(array);
				break;
			case this.gl.FLOAT:
			default:
				data = new Float32Array(array);
				break;
		}
		return data;
	}
}



GLU.Texture = function(gl){
	GLU.Core.apply(this, [gl]);

	this.texture = this.gl.createTexture();
	this.width = 0;
	this.height = 0;
}
GLU.Texture.prototype = {
	bind: function(){
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
	},
	unbind: function(){
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
	},
	setImage: function(image){
		this.width = image.width;
		this.height = image.height;
		this.bind();
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        //this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);//no interpolation
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);//linear
        //this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);//no mipmapping

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_NEAREST);  
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);//nice mipmapping    
  		this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri( this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE );
        this.gl.texParameteri( this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE );
        this.unbind();
	},
	setCharData: function(charArray, width, height){
		height = height || 1;
		width = width || (floatArray.length/height);
		this.width = width;
		this.height = height;

		var gl = this.gl;
		this.bind();
		this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
    	gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, charArray);
        
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        this.unbind();
	},
	setFloatData: function(floatArray, width, height){
		height = height || 1;
		width = width || (floatArray.length/height);
		this.width = width;
		this.height = height;

		var gl = this.gl;
		this.bind();
		this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
    	gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, floatArray);
        
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        this.unbind();
	},
	setupRenderBuffer: function(width, height){
		var gl = this.gl;
		this.width = width;
		this.height = height;
		this.bind();
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		this.unbind();
	},
	loadImage: function(url){
		var image = new Image();
		var that = this;
        image.onload = function () {
            that.setImage(image);
        }
        image.src = url;
	}
}



GLU.Material = function(gl, program, textures){
	GLU.Core.apply(this, [gl]);

	this.program = program;
	this.textures = textures || {};
	this.blendFunction = this.blendingDefault;
}
GLU.Material.prototype = {
	bind: function(){
		//set blending
		this.blendFunction();
  //       this.gl.enable(this.gl.BLEND);
  //       this.gl.enable(this.gl.DEPTH_TEST);
		// this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE);
		// this.gl.enable(this.gl.CULL_FACE);
		// this.gl.cullFace(this.gl.BACK);

		this.program.bind();

		//bind textures
		this.bindTextures();
	},
	bindTextures: function(){
		var textureCount = 0;
		for(var uniformName in this.textures){
			var texture = this.textures[uniformName];
			this.gl.activeTexture(this.getGLTextureSlot(textureCount));
			texture.bind();
			this.gl.uniform1i(this.program[uniformName], textureCount);
			++textureCount;
		}
	},
	getGLTextureSlot: function(id){
		var slotName = 'TEXTURE'+id;
		return this.gl[slotName];//e.g. gl.TEXTURE4
	},
	unbind: function(){
		
	},
	blendingDefault: function(){
        this.gl.enable(this.gl.BLEND);
        this.gl.enable(this.gl.DEPTH_TEST);
		this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE);
		this.gl.enable(this.gl.CULL_FACE);
		this.gl.cullFace(this.gl.BACK);
	},
	blendingParticles: function(){
        this.gl.enable(this.gl.BLEND);
        this.gl.disable(this.gl.DEPTH_TEST);
		this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE);
		this.gl.disable(this.gl.CULL_FACE);
//		this.gl.cullFace(this.gl.BACK);
	}
}



GLU.Geometry = function(gl, buffers){
	GLU.Core.apply(this, [gl]);
	this.buffers = buffers || {};
	this.indices = null;
}
GLU.Geometry.prototype = {
	makeRect: function(width, height, vertexName, texName){
		width = width || 1;
		height = height || 1;
		vertexName = vertexName || 'aVertexPosition';
		texName = texName || 'aTextureCoord';

		var halfw = width/2;
		var halfh = height/2;

        var vertexArray = [
            -halfw, -halfh,  0,
             halfw, -halfh,  0,
             halfw,  halfh,  0,
            -halfw,  halfh,  0
    	];
    	var texArray = [
			0.0, 0.0,
			1.0, 0.0,
			1.0, 1.0,
			0.0, 1.0
    	];
    	var indexArray = [
	    	0, 1, 2,
	    	0, 2, 3
    	];
    	this.makeFromArrays(indexArray, vertexArray, vertexName, texArray, texName);

	},
	makeSphere: function(segmentsH, segmentsV, radius, vertexName, texName){
		segmentsH = segmentsH || 16;
		segmentsV = segmentsV || 8;
		radius = radius || 1;

		vertexName = vertexName || 'aVertexPosition';
		texName = texName || 'aTextureCoord';

     	var vertexArray = [];
    	var texArray = [];
    	var indexArray = [];

		for(var j = 0; j <= segmentsV; ++j){
			var thetaV = Math.PI*(1 - j/segmentsV);

			var ringX = radius*Math.sin(thetaV);//radius of ring
			var ringY = radius*Math.cos(thetaV);//Y position of ring

	    	for(var i = 0; i <= segmentsH; ++i){
	    		var thetaH = 2*Math.PI*(1 - i/segmentsH);
	    		var x = ringX*Math.cos(thetaH);
	    		var z = ringX*Math.sin(thetaH);
	    		var y = ringY;
	    		vertexArray.push(x, y, z);
	    		texArray.push(i/segmentsH, j/segmentsV);
    		}
    	}

    	var rowSize = segmentsH+1;
    	for(var j = 0; j < segmentsV; ++j){
    		var row0 = j*rowSize;
    		var row1 = row0+rowSize;
    		for(var i = 0; i < segmentsH; ++i){
    			var a = row0+i;
    			var b = a+1;
    			var d = row1+i;
    			var c = d+1;
    			indexArray.push(a, b, c, a, c, d);
    		}
    	}
    	this.makeFromArrays(indexArray, vertexArray, vertexName, texArray, texName);
	},
	makeFromArrays: function(indexArray, vertexArray, vertexName, texArray, texName, colorArray, colorName){
		if(indexArray){
    		var indexBuffer = new GLU.Buffer(this.gl, this.gl.ELEMENT_ARRAY_BUFFER, this.gl.UNSIGNED_SHORT, 1, this.gl.STATIC_DRAW);	
		    indexBuffer.setArray(indexArray);
	    	this.indices = indexBuffer;
    	}
    	if(vertexArray && vertexName){
			var vertexBuffer = new GLU.Buffer(this.gl, this.gl.ARRAY_BUFFER, this.gl.FLOAT, 3, this.gl.STATIC_DRAW);
        	vertexBuffer.setArray(vertexArray);
	    	this.buffers[vertexName] = vertexBuffer;
        }
        if(texArray && texName){
        	var texBuffer = new GLU.Buffer(this.gl, this.gl.ARRAY_BUFFER, this.gl.FLOAT, 2, this.gl.STATIC_DRAW);
    		texBuffer.setArray(texArray);
	    	this.buffers[texName] = texBuffer;
    	}
    	if(colorArray && colorName){
    		var colorBuffer = new GLU.Buffer(this.gl, this.gl.ARRAY_BUFFER, this.gl.FLOAT, 4, this.gl.STATIC_DRAW);	
		    colorBuffer.setArray(colorArray);
	    	this.buffers[colorName] = colorBuffer;
    	}
	},
	mergePoints: function(vertexArray, texArray, indexArray){
		var newVArray = [];
		var newTArray = [];
		var newIArray = [];

		var lookup = {};
		var uniques = [];

		for(var i = 0; i < indexArray.length; ++i){
			var index = indexArray[i];
			var vx = vertexArray[index*3];
			var vy = vertexArray[index*3+1];
			var vz = vertexArray[index*3+2];

			var tx = texArray[index*2];
			var ty = texArray[index*2+1];
			var identity = (''+vx+','+vy+','+vz+','+tx+','+ty);
			
			var id;
			if(!lookup.hasOwnProperty(identity)){
				id = uniques.length;
				lookup[identity] = id;
				uniques.push([vx,vy,vz,tx,ty]);
			} else {
				id = lookup[identity];
			}

			newIArray.push(id);
		}
		
		for(var i = 0; i < uniques.length; ++i){
			var unique = uniques[i];
			newVArray.push(unique[0], unique[1], unique[2]);
			newTArray.push(unique[3], unique[4]);
		}
		
		return [newVArray, newTArray, newIArray];
	}
}



GLU.Object = function(gl, geometry, material, uniforms){
	GLU.Core.apply(this, [gl]);
	this.geometry = geometry || {};
	this.material = material;
	this.uniforms = uniforms || [];
}
GLU.Object.prototype = {
	bind: function(){
		this.material.bind();

		//bind buffers
		var buffers = this.geometry.buffers;
		for(var attribName in this.geometry.buffers){
			var buffer = this.geometry.buffers[attribName];
			buffer.bind();
			var position = this.material.program[attribName];
			if(position != undefined){
				this.gl.vertexAttribPointer(position, buffer.itemSize, buffer.dataType, false, 0, 0);
			}
		}

		for(var i = 0; i < this.uniforms.length; ++i){
			var uniform = this.uniforms[i];
			this.updateUniform(uniform);
			//uniform.bind(this.material.program);
		}

		this.geometry.indices.bind();

	},
	updateUniform: function(uniform){
		uniform.bind(this.material.program);
	},
	draw: function(){
		this.drawNum(this.geometry.indices.length);
    },
    drawNum: function(num){
        this.gl.drawElements(this.gl.TRIANGLES, num, this.geometry.indices.dataType, 0);
    }
};



GLU.FrameBuffer = function(gl){
	GLU.Core.apply(this, [gl]);
	var width = 512;
	var height = 512;

	var framebuffer = this.framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	framebuffer.width = width;
	framebuffer.height = height;

	var texture = this.texture = new GLU.Texture(gl);
	texture.bind();
	var renderbuffer = this.renderbuffer = gl.createRenderbuffer();

	this.setSize(width, height);


	gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.texture, 0);
	//gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	texture.unbind();
}
GLU.FrameBuffer.prototype = {
	bind: function(){
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
	},
	unbind: function(){
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
	},
	setSize: function(width, height){
		var gl = this.gl;
		
		this.texture.setupRenderBuffer(width, height);

		//gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
		//gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
		//gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	}
}