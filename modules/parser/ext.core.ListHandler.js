/*
 * Create list tag around list items and map wiki bullet levels to html
 */

function ListHandler ( manager ) {
	this.manager = manager
	this.reset();
	this.manager.addTransform( this.onListItem.bind(this), 
			this.listRank, 'tag', 'listItem' );
	this.manager.addTransform( this.onEnd.bind(this),
			this.listRank, 'end' );
}

ListHandler.prototype.listRank = 2.49; // before PostExpandParagraphHandler
ListHandler.prototype.delta = .001;

ListHandler.prototype.bulletCharsMap = {
	'*': { list: 'ul', item: 'li' },
	'#': { list: 'ol', item: 'li' },
	';': { list: 'dl', item: 'dt' },
	':': { list: 'dl', item: 'dd' },
};

ListHandler.prototype.reset = function() {
	this.newline = false;
	this.bstack = []; // Bullet stack, previous element's listStyle
	this.endtags = [];  // Stack of end tags
};

ListHandler.prototype.onNewline = function ( token, frame, prevToken ) {
	var tokens = [];
	//token.rank = this.listRank + this.delta;
	if (!this.bstack.length) {
		tokens.push(token);
	}
	else
	{
		if (this.newline)
			tokens = tokens.concat(this.end());

		this.newline = true;
	}
	return { tokens: tokens };
};

ListHandler.prototype.onEnd = function( token, frame, prevToken ) {
	//token.rank = this.listRank + this.delta;
	return { tokens: this.end().concat([token]) };
};

ListHandler.prototype.end = function( ) {
	// pop all open list item tokens
	var tokens = this.popTags(this.bstack.length);
	this.reset();
	this.manager.removeTransform( this.listRank, 'newline' );
	return tokens;
};

ListHandler.prototype.onListItem = function ( token, frame, prevToken ) {
	if (token.constructor === TagTk)
	{
		// convert listItem to list and list item tokens
		return { tokens: this.doListItem( this.bstack, token.bullets ) };
	}
	return { token: token };
};

ListHandler.prototype.commonPrefixLength = function (x, y) {
	var minLength = Math.min(x.length, y.length);
	for(var i = 0; i < minLength; i++) {
		if (x[i] != y[i])
			break;
	}
	return i;
};

ListHandler.prototype.pushList = function ( container ) {
	this.endtags.push( new EndTagTk( container.list ));
	this.endtags.push( new EndTagTk( container.item ));
	return [
		new TagTk( container.list ),
		new TagTk( container.item )
	];
};

ListHandler.prototype.popTags = function ( n ) {
	var tokens = [];
	for(;n > 0; n--) {
		// push list item..
		tokens.push(this.endtags.pop());
		// and the list end tag
		tokens.push(this.endtags.pop());
	}
	return tokens;
};

ListHandler.prototype.isDlDd = function (a, b) {
	var ab = [a,b].sort();
	return (ab[0] === ':' && ab[1] === ';');
};

ListHandler.prototype.doListItem = function ( bs, bn ) {
	var prefixLen = this.commonPrefixLength (bs, bn),
		changeLen = Math.max(bs.length, bn.length) - prefixLen,
		prefix = bn.slice(0, prefixLen);
	this.newline = false;
	this.bstack = bn;
	if (!bs.length)
	{
		this.manager.addTransform( this.onNewline.bind(this),
				this.listRank, 'newline' );
	}
	// emit close tag tokens for closed lists
	if (changeLen === 0)
	{
		var itemToken = this.endtags.pop();
		this.endtags.push(new EndTagTk( itemToken.name ));
		return [
			itemToken,
			new TagTk( itemToken.name )
		];
	}
	else if ( bs.length == bn.length
			&& changeLen == 1
			&& this.isDlDd( bs[prefixLen], bn[prefixLen] ) )
	{
		// handle dd/dt transitions
		var newName = this.bulletCharsMap[bn[prefixLen]].item;
		this.endtags.push(new EndTagTk( newName ));
		return [
			this.endtags.pop(),
			new TagTk( newName )
		];
	}
	else
	{
		var tokens = this.popTags(bs.length - prefixLen);

		if (prefixLen > 0 && bn.length == prefixLen ) {
			var itemToken = this.endtags.pop();
			tokens.push(itemToken);
			tokens.push(new TagTk( itemToken.name ));
			this.endtags.push(new EndTagTk( itemToken.name ));
		}

		for(var i = prefixLen; i < bn.length; i++) {
			if (!this.bulletCharsMap[bn[i]])
				throw("Unknown node prefix " + prefix[i]);

			tokens = tokens.concat(this.pushList(this.bulletCharsMap[bn[i]]));
		}
		return tokens;
	}
};

if (typeof module == "object") {
	module.exports.ListHandler = ListHandler;
}
