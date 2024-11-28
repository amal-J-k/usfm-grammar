const Parser = require('tree-sitter');
const assert = require('assert');

const {USFMGenerator} = require("./usfmGenerator");
const {USJGenerator} = require("./usjGenerator"); 
const {ListGenerator} = require("./listGenerator");
const {USXGenerator} = require("./usxGenerator")
const { includeMarkersInUsj, excludeMarkersInUsj, Filter } = require("./filters.js");
const USFM3 = require('tree-sitter-usfm3');
const { Query } = Parser;

class USFMParser {

	constructor(usfmString=null, fromUsj=null, fromUsx=null) {
		let inputsGiven = 0
        if (usfmString !== null) {
            inputsGiven += 1
        }
        if (fromUsj !== null) {
            inputsGiven += 1
        }
        if (fromUsx !== null) {
            inputsGiven += 1
        }

        if (inputsGiven > 1) {
            throw new  Error(`Found more than one input!
Only one of USFM, USJ or USX is supported in one object.`)
        }
        if (inputsGiven === 0) {
            throw Error("Missing input! Either USFM, USJ or USX is to be provided.")
        }

        if (usfmString !== null) {
        	if (typeof usfmString !== "string" || usfmString === null) {
				throw new Error("Invalid input for USFM. Expected a string.");
			}
            this.usfm = usfmString;
        } else if(fromUsj !== null) {
        	this.usj = fromUsj;
        	this.usfm = this.convertUSJToUSFM()
        } else if (fromUsx !== null) {
        	this.usx = fromUsx;
        	this.usfm = this.convertUSXToUSFM()
        }
		this.parser = null;
		this.initializeParser();

		this.syntaxTree = null;
		this.errors = [];
        this.warnings = [];
        this.parseUSFM();

	}
	initializeParser() {
		this.parser = new Parser();
		this.parser.setLanguage(USFM3);
		this.parserOptions = Parser.Options = {
						      bufferSize: 1024 * 1024,
						    };
	}

	toSyntaxTree() {
		return this.syntaxTree.toString();
	}

	toUSJ(excludeMarkers = null,
		includeMarkers = null,
		ignoreErrors = false,
		combineTexts = true,) {
		this.usj = this.convertUSFMToUSJ(excludeMarkers = excludeMarkers,
								includeMarkers = includeMarkers,
								ignoreErrors = ignoreErrors,
								combineTexts = combineTexts,);
		return this.usj;
	}

	usjToUsfm(usjObject) {
		if (typeof usjObject !== "object" || usjObject === null || (!usjObject.hasOwnProperty('type'))) {
			throw new Error("Invalid input for USJ. Expected USJ json object.");
		}
		if (!this.parser) {
			this.initializeParser();
		}
		this.usj = usjObject;
		this.usfm = this.convertUSJToUSFM();
		return this.usfm;
	}

	parseUSFM() {
		let tree = null;
		try {
			if (this.usfm.length > 25000) {
				tree = this.parser.parse(this.usfm, null, this.parserOptions);
			}
			else {
				tree = this.parser.parse(this.usfm);
			}
		} catch (err) {
			throw err;
			// console.log("Error in parser.parse()");
			// console.log(err.toString());
			// console.log(this.usfm);
		}
		this.checkForErrors(tree);
		this.checkforMissing(tree.rootNode);
		// if (error) throw error;
		this.syntaxTree = tree.rootNode;
	}


	checkForErrors(tree) {
		const errorQuery = new Query(USFM3, "(ERROR) @errors");
		const errors = errorQuery.captures(tree.rootNode);

		if (errors.length > 0) {
			this.errors = errors.map(
				(error) =>
					`At ${error.node.startPosition.row}:${error.node.startPosition.column}, Error: ${this.usfm.substring(error.node.startIndex, error.node.endIndex)}`,
			);
			return new Error(`Errors found in USFM: ${this.errors.join(", ")}`);
		}
	}

	checkforMissing(node) {
	   for (let n of node.children) {
	        if (n.isMissing){
	        		this.errors.push(
						`At ${n.startPosition.row+1}:${n.startPosition.column}, Error: Missing ${n.type}`) 
	        } 
	        this.checkforMissing(n);
	    }
	}
	

	convertUSJToUSFM() {
		const outputUSFM = new USFMGenerator().usjToUsfm(this.usj); // Simulated conversion
		return outputUSFM;
	}

	convertUSXToUSFM() {
		try {
			assert(1 <= this.usx.nodeType && this.usx.nodeType <= 12 ,
		        'Input must be an instance of xmldom Document or Element'
		    );
			if (this.usx.tagName !== "usx") {
				assert(this.usx.getElementsByTagName('usx').length === 1,
					'Expects a <usx> node. Refer docs: https://docs.usfm.bible/usfm/3.1/syntax.html#_usx_usfm_xml');

				this.usx = this.usx.getElementsByTagName('usx')[0]
			}
			// assert(this.usx.childNodes[0].tagName === 'book', "<book> expected as first element in <usx>")

		} catch(err) {
			throw new Error("USX not in expected format. "+err.message)
		}
		try {
			const usfmGen = new USFMGenerator()
			usfmGen.usxToUsfm(this.usx);
			// console.log(usfmGen.usfmString)
			return usfmGen.usfmString;
		} catch(err) {
	        let message = "Unable to do the conversion from USX to USFM. ";
	        throw new Error(message, { cause: err });
		}
	}

	convertUSFMToUSJ(
		excludeMarkers = null,
		includeMarkers = null,
		ignoreErrors = false,
		combineTexts = true,) {
		if (!ignoreErrors && this.errors.length > 0) {
			let errorString = this.errors.join("\n\t");
			throw new Error(
				`Errors present:\n\t${errorString}\nUse ignoreErrors = true, as third parameter of toUSJ(), to generate output despite errors.`,
			);
		}

		let outputUSJ;
		try {
			let usjGenerator = new USJGenerator(
				USFM3,
				this.usfm
			);

			usjGenerator.nodeToUSJ(this.syntaxTree, usjGenerator.jsonRootObj);
			outputUSJ = usjGenerator.jsonRootObj;
		} catch (err) {
			let message = "Unable to do the conversion. ";
			if (this.errors) {
				let errorString = this.errors.join("\n\t");
				message += `Could be due to an error in the USFM\n\t${errorString}`;
			}
			else {
				message = err.message;
			}
			return {error: message};
		}

		if (includeMarkers) {
			outputUSJ = Filter.keepOnly(outputUSJ, [...includeMarkers, 'USJ'], combineTexts);
		}
		if (excludeMarkers) {
			outputUSJ = Filter.remove(outputUSJ, excludeMarkers, combineTexts);
		}

		return outputUSJ;
	}

	toList(
	    excludeMarkers = null,
	    includeMarkers = null,
	    ignoreErrors = false,
	    combineTexts = true
	) {
	    /* Uses the toJSON function and converts JSON to CSV
	       To be re-implemented to work with the flat JSON schema */

	    if (!ignoreErrors && this.errors.length > 0) {
			let errorString = this.errors.join("\n\t");
	        throw new Error(`Errors present:\n\t${errorString}\nUse ignoreErrors=true to generate output despite errors`);
	    }

	    try {
	        const usjDict = this.toUSJ(excludeMarkers, includeMarkers, ignoreErrors, combineTexts);

	        const listGenerator = new ListGenerator();
	        listGenerator.usjToList(usjDict);
	    	return listGenerator.list;

	    } catch (exe) {
	        let message = "Unable to do the conversion. ";
	        if (this.errors.length > 0) {
				let errorString = this.errors.join("\n\t");
	            message += `Could be due to an error in the USFM\n\t${errorString}`;
	        }
	        throw new Error(message, { cause: exe });
	    }

	}

	toBibleNlpFormat(ignoreErrors = false) {
	    /* Uses the toUSJ function with only BVC and text.
	       Then the JSOn is converted to list of verse texts and vrefs*/

	    if (!ignoreErrors && this.errors.length > 0) {
			let errorString = this.errors.join("\n\t");
	        throw new Error(`Errors present:\n\t${errorString}\nUse ignoreErrors=true to generate output despite errors`);
	    }

	    try {
	        const usjDict = this.toUSJ(null, [...Filter.BCV, ...Filter.TEXT], ignoreErrors, true);
	        const listGenerator = new ListGenerator();
	        listGenerator.usjToBibleNlpFormat(usjDict);
	    	return listGenerator.bibleNlpFormat;

	    } catch (exe) {
	        let message = "Unable to do the conversion. ";
	        if (this.errors.length > 0) {
				let errorString = this.errors.join("\n\t");
	            message += `Could be due to an error in the USFM\n\t${errorString}`;
	        }
	        throw new Error(message, { cause: exe });
	    }

	}

	toUSX(ignoreErrors = false) {
	    /* Convert the syntax_tree to the XML format (USX) */

	    if (!ignoreErrors && this.errors.length > 0) {
			let errorString = this.errors.join("\n\t");
	        throw new Error(`Errors present:\n\t${errorString}\nUse ignoreErrors=true to generate output despite errors`);
	    }
	    let xmlContent = null;

	    try {
	        // Initialize the USX generator (assuming the constructor is already implemented in JS)
	        const usxGenerator = new USXGenerator(USFM3,
													this.usfm);
	        
	        // Process the syntax tree and convert to USX format
	        usxGenerator.node2Usx(this.syntaxTree, usxGenerator.xmlRootNode);

	        // xmlContent = usxSerializer.serializeToString(usxGenerator.xmlRootNode);
	        xmlContent = usxGenerator.xmlRootNode;
	    } catch (exe) {
	        let message = "Unable to do the conversion. ";
	        if (this.errors.length > 0) {
				let errorString = this.errors.join("\n\t");
	            message += `Could be due to an error in the USFM\n\t${errorString}`;
	        }
	        throw new Error(message, { cause: exe });
	    }

	    // Return the generated XML structure (in JSON format)
	    return xmlContent;
	}


}


exports.USFMParser = USFMParser;
exports.Filter = Filter;
// exports.Format = Format;