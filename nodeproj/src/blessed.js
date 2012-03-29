"use strict";

/**
 * Sets 'Blessed' in the global scope in a closure compiler compatible way.
 * @name Blessed
 * @namespace holds the basic Blessed functions.
 */
(function(exports) {
	/**
	 * This is exposed only for testing purposes.
	 * @private
	 */
	var ERROR_MESSAGES = {
			"undefined": "{0}: Bad argument: parameter '{1}' was null or undefined.",
			"notFunc": "{0}: Bad argument: parameter '{1}' should be a function or the name of a function. Was '{2}' (type {3}).",
			"notNumber": "{0}: Bad argument: parameter '{1}' should be a number. Was '{2}' (type {3}).",
			"negative": "{0}: Bad argument: parameter '{1}' may not be negative, was '{2}'.",
			"unimplemented": "Interface property '{0}' is not implemented.",
			"extendedProp": "{0}: Already extended: prototype has property '{1}' (type {2}).",
			"alreadyExtended": "extend: Already extended."
	};
	
	/**
	 * Just a renaming to make later code more readable.
	 * @private
	 */
	function toArray(arg, skipping) {return Array.prototype.slice.call(arg, skipping);}
	
	/**
	 * If you want an object and you've been passed a function instead, it's likely that
	 * the function is a constructor and you should look at its prototype.
	 * @private
	 */ 
	function objOrPrototype(variant) {
		if (typeof variant === 'function' && variant.prototype != null) {
			return variant.prototype;
		}
		return variant;
	}
	
	/**
	 * A marker object to be passed to unBindAt and bless. Indicates that they should operate
	 * on the last argument of any function they create delegates for.  Requires that the
	 * function has an appropriate 'length' property.
	 * 
	 * @memberOf Blessed
	 * @constant
	 */
	var LAST_ARG = {'toString':function(){return "LAST_ARG";}};
	
	/**
	 * Creates a wrapper function that slots the this pointer into the right place and calls the target function.
	 * 
	 * It's the opposite of bind in that bind converts a method into a function and unBindAt converts
	 * a function into a method.
	 * 
	 * @param {object} object The source object that holds the function (or a constructor function with a prototype that holds the function). May not be null.
	 * @param {string} func The name of the function to unbind, or potentially the function itself. If a string, it must refer to a real function.  May not be null.
	 * @param {number} thisArgNumber The index of the argument that the 'this' point should be bound to.  Other arguments will be made up from the arguments passed
	 * 						to the returned function. Optional, will default to 0 if not provided. If provided, must be a positive number.
	 * 						May be the marker object LAST_ARG instead, in which case, the provided function must provide a 'length' attribute greater than 0.
	 * 
	 * @returns a function that when called will insert the current value of 'this' into the appropriate argument position then call the target function.
	 * @type function
	 * @memberOf Blessed
	 */
	function unBindAt(object, func, thisArgNumber) {
		if (object == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "unBindAt", "object"));
		if (func == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "unBindAt", "func"));
		if (typeof func === 'string' && typeof object[func] === 'function') func = object[func];
		if (typeof func !== 'function') throw new Error(interpolate(ERROR_MESSAGES["notFunc"], "unBindAt", "func", func, typeof func));
		if (thisArgNumber == null) thisArgNumber = 0;
		if (thisArgNumber === LAST_ARG) thisArgNumber = (func["_applyLength"] || func.length) - 1;
		if (isNaN(thisArgNumber)) throw new Error(interpolate(ERROR_MESSAGES["notNumber"], "unBindAt", "thisArgNumber", thisArgNumber, typeof thisArgNumber));
		if (thisArgNumber < 0) throw new Error(interpolate(ERROR_MESSAGES["negative"], "unBindAt", "thisArgNumber", thisArgNumber));
		
		return function() {
			var args = toArray(arguments); 
			args.splice(thisArgNumber, 0, this);
			return func.apply(object, args);
		};
	}

	/**
	 * Creates delegates on a 'blessee' object for all the utility methods on a 'benediction' object.
	 * 
	 * Suppose you have a bunch of utility functions that look like this
	 * <pre>
	 * var FooUtility = {
	 * 	util1: function(aFooObject, parameterA) ...
	 * 	util2: function(aFooObject, parameterA, parameterB) ...
	 * }
	 * </pre>
	 * 
	 * It would often be nice to call them like this instead:
	 * <pre>
	 * 	aFooObject.util1(parameterA);
	 * 	aFooObject.util2(parameterA, parameterB);
	 * </pre>
	 * You can use this 'bless' function to add them all:
	 * <pre>
	 * 	bless(aFooObject, FooUtility);
	 * </pre>
	 * or if you instead call
	 * <pre>
	 * 	bless(Foo.prototype, FooUtility);
	 * </pre>
	 * It will add all the functions onto prototype of Foo, then all Foos will have them.
	 * 
	 * @param {object} blessee An object (or constructor with a prototype) that should receive the delegated functions. May not be null or undefined.
	 * @param {object} benediction An object (or constructor with a prototype) that provides functions that should be delegated to. May not be null or undefined.
	 * @param {number} inWhichArg The index of the argument of the target functions (on 'benediction') that 'this' should be inserted into during delegation.
	 * 						Optional.  Will default to 0 if not provided.  Can also be the Blessed.LAST_ARG marker object instead.
	 * @memberOf Blessed
	 */
	function bless(blessee, benediction, inWhichArg) {
		if (benediction == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "bless", "benediction"));
		if (blessee == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "bless", "blessee"));
		blessee = objOrPrototype(blessee);
		benediction = objOrPrototype(benediction);
		
		for (var property in benediction) {
			// Don't copy things that are already there:
			// Choices were skip / fail / warn / overwrite.
			// Since I don't have a good way of warning, and at the moment, I'm thinking mainly of
			// cases like bless(Arrays.prototype, EcmaScript5ArrayFuncs), not copying ones already there
			// seems like the right decision.
			// I intentionally copy things from the prototype chain of the benediction because I don't see why
			// you wouldn't want to be able to make benedictions inherit from each other.
			if (blessee[property] == null) {
				if (typeof benediction[property] === 'function') {
					blessee[property] = unBindAt(benediction, property, inWhichArg);
				} else {
					blessee[property] = benediction[property];
				}
			}
		}
	}
	
	/**
	 * Sets up the prototype chain for inheritance in much the same way that
	 * <pre>	subclass.prototype = Object.create(superclass.prototype);</pre>
	 * does.
	 * 
	 * <p>Extra is that it adds a reference to 'parent' to make it 
	 * easier to call in your constructor, plus checks that the subclass
	 * hasn't already been extended.</p>
	 * 
	 * <p>Setting up the prototype chain is only half the battle,
	 * remember to also call the superconstructor in the subclass constructor
	 * <pre>	&lt;SubclassName&gt;.parent.call(this, arg1, arg2);</pre>
	 * <p>If you're properly paranoid, check it for a return value, too, since if it
	 * returns something you need to work with that instead of 'this' and return it
	 * yourself to make it work.  Better to avoid extending constructors that do that...</p>
	 * 
	 * @param {object} subclass The object that will be subclassed.  Must not already have been subclassed.  May not be null or undefined.
	 * @param {object} superclass The object that will be the superclass.  May not be null or undefined.
	 * 
	 * @memberOf Blessed
	 */
	function extend(subclass, superclass) {
		if (subclass == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "extend", "subclass"));
		if (superclass == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "extend", "superclass"));
		// Ensure that the subclass is not already extended.
		// There is only one prototype chain in JS.  Calling extend twice is likely to be
		// a coding error.
		if (subclass.prototype && subclass.prototype.constructor === subclass) {
			for (var key in subclass.prototype) {
				if (subclass.prototype.hasOwnProperty(key) === true) {
					throw new Error(interpolate(ERROR_MESSAGES["extendedProp"], "extend", key, typeof subclass.prototype[key]));
				}
			}
		} else {
			throw new Error(ERROR_MESSAGES["alreadyExtended"]);
		}
		
		// this works in older browsers and does pretty much the same as 
		//     subclass.prototype = Object.create(superclass.prototype);
		subclass["parent"] = superclass;
		function _Clazz() {}
		_Clazz.prototype = superclass.prototype;
		subclass.prototype = new _Clazz();
	}

	/**
	 * <p>Does a copy of properties from (potentially many) mixins to the child.
	 * The order of mixins is priority order, so later mixins cannot overwrite earlier mixins, and no mixins
	 * overwrite things that the client has already (directly - they do overwrite inherited properties from the prototype chain).</p>
	 * 
	 * <p>I like to use this to pull functions into the global scope: e.g in a Browser
	 * <pre>	mixin(window, Blessed, Fun);</pre>
	 * will mean I can call all the methods from Blessed and Fun without prefixing them.
	 * <p>If 'with' wasn't the 'work of the devil', you could even do that without corrupting your global scope:
	 * <pre>	with (mixin({}, List, Fun)) {
	 * 		// in this scope you can use List and Fun methods without prefix!
	 * 	}</pre>
	 * <p>Of course, 'with' <em>is</em> the work of the devil, so you wouldn't do that.  You could instead set the mixed version
	 * to a short variable and reference it using that (ugly though :-( ) 
	 * <pre>	var _ = mixin({}, Blessed, Fun);
	 * 	_.bless(thingy, wotsit);</pre>
	 * 
	 * @param {object} child The object or constructor with prototype that elements from each of the provided 'mix's should be copied to.
	 * @param {object} mix Objects or constructors with prototype that elements should be copied from.
	 * 
	 * @returns The provided child object.
	 * @type object
	 * @memberOf Blessed
	 */
	function mixin(child, mix) {
		var i, len, property, ingredient;
		
		if (child == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "mixin", "child"));
		child = objOrPrototype(child);
		
		for (i = 1, len = arguments.length; i < len; ++i) {
			ingredient = objOrPrototype(arguments[i]);
			for (property in ingredient) {
				if (child.hasOwnProperty(property) === false) {
					child[property] = ingredient[property];
				}
			}
		}
		return child;
	}

	/**
	 * I know that javascript doesn't have interfaces, but it can be useful, just after having defined a
	 * class to assert that it implements a bundle of methods you've previously defined and documented
	 * (which for the sake of argument, we'll call an 'interface').
	 * 
	 * @param {object} child The object that is intended to meet the specification of the provided interface.  May not be null or undefined.
	 * @param {object} interf The object, or constructor function with prototype that specifies which properties must be provided by the child.  May not be null or undefined.
	 *
	 * @throws {Error} A 'Interface property ... is not implemented.' error if there are missing properties.
	 * @memberOf Blessed
	 */
	function assertImplements(child, interf) {
		if (child == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "assertImplements", "child"));
		if (interf == null) throw new Error(interpolate(ERROR_MESSAGES["undefined"], "assertImplements", "interf"));
		
		interf = objOrPrototype(interf);
		for (var property in interf) {
			if (child[property] == null) {
				throw new Error(interpolate(ERROR_MESSAGES["unimplemented"], property));
			} 
		};
	};
	
	/**
	 * <p>Takes a string and interpolates the other arguments. The format expected
	 * for the string is that {0} indicates the first thing to be interpolated.</p>
	 * 
	 * An example:
	 * <pre>interpolate("{0} world", "hello") == "hello world";</pre>
	 * 
	 * Will interpolate something into potentially many places in the string.
	 * 
	 * @param {string} str The string into which values should be interpolated.  If null will return null.
	 */
	function interpolate(str) {
		if (str == null) return null;
		for (var i = 1, len = arguments.length; i < len; ++i) {
			str = str.replace("{"+(i-1)+"}", (arguments[i] || "").toString());
		}
		return str;
	}
	
	mixin(exports, {
		'interpolate': interpolate, 'ERROR_MESSAGES':ERROR_MESSAGES,
		'LAST_ARG':LAST_ARG, 'unBindAt':unBindAt,
		'bless':bless, 'extend':extend, 'mixin':mixin, 'assertImplements':assertImplements
	});
})((this.window == null && exports) || (this["Blessed"] = {}));