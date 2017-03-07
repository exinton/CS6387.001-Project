var moment 						= require('moment');

var dal         				= require('../data_access/dal');
var authenticate         		= require('./authenticate');

var methods = {};

methods.buyBook = function(request, response, connection)
{
	function afterCheckTokenCallback(internalUserId)
	{
		//Get the parameters from the body of the HTTP POST message
		var providedForSaleId = request.body.forSaleId;
		
		//Declare variables that will be set and used throughout this request.
		var buyerId = internalUserId;
		var buyerNickname;
		var convId;
		var sellerId;
		var bookIsbn;
		var dateTimeOfTransaction = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
		
		
		function insert_Transaction_callback(err,result)
		{
			if (err) 
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			else
			{
				response.send({success: true, msg: 'Book has put on hold.', transactionId: result.insertId});
			}
		}
		
		function createTransaction()
		{
			dal.insert_Transaction(connection, insert_Transaction_callback, buyerId, dateTimeOfTransaction, convId, providedForSaleId)
		}
		
		function insert_Message_callback(err,result)
		{
			if (err) 
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			else
			{
				//Successfully sent an automated message from buyer to seller.
				//Now, need to create a new transaction.
				createTransaction();
			}
		}
		
		function sendAutomatedMessageFromBuyerToSeller()
		{
			//TODO: fix up the automated message to use the book's title instead of ISBN.
			dal.insert_Message(connection, insert_Message_callback, sellerId, buyerId, buyerNickname + " wants to buy your book " + bookIsbn + "!", convId)
		}
		
		function setConversationId(conversationId)
		{
			convId = conversationId;
			sendAutomatedMessageFromBuyerToSeller();		
		}
		
		function createConversation_callback(conversationId, err)
		{
			if (err) 
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			else
			{
				setConversationId(conversationId);
			}
		}
		
		function generateConversation()
		{
			dal.createConversation(connection, createConversation_callback, internalUserId, sellerId);
		}
		
		function get_conversation_by_recipients_callback(err, rows, fields)
		{
			if (err)
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			else if(rows.length === 0)
			{ 
				generateConversation();
			}
			else
			{
				//The query returned a previously existing Conversation record between these two users.
				//Get the conversation ID and send it alont to setConversationId().
				setConversationId(rows[0].iD);
			}
		}
		
		function checkIfConversationAlreadyExists()
		{
			dal.get_conversation_by_recipients(connection, get_conversation_by_recipients_callback, internalUserId, sellerId);
		}
		
		function get_User_by_internalUserId_callback(err, rows, fields)
		{
			if (err)
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			else if(rows.length === 0)
			{ 
				response.status(500).send({success: false, msg: 'Error. Could not fetch buyer nickname.'});
			}
			else
			{
				buyerNickname = rows[0].nickname;
				
				//Now that we have the nickname of the buyer, next step is to check if a conversation between the buyer and seller already exists.
				checkIfConversationAlreadyExists();
			}
		}
		
		function getBuyerNickname()
		{
			dal.get_User_by_internalUserId(connection, get_User_by_internalUserId_callback, buyerId);
		}
		
		function get_transactions_by_ForSaleId_callback(err, rows, fields)
		{
			if (err)
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			
			else
			{
				//Loop through the transactions associated with this For Sale entry and check each status.
				for (var i in rows) 
				{
					//If the transaction row's status is either pending or completed, then return an error to the client.
					if(rows[i].status === 0 || rows[i].status === 2)
					{
						response.status(400).send({success: false, msg: 'The specified For Sale entry already has a transaction associated with it.'});
					}
				}
				
				//If we made it this far, then none of the transactions have a status of pending or completed.
				//Now that we have verified that there is not already a transaction for this For Sale entry, next step is to get the nickname of the buyer 
				//so that an automated message can be sent form buyer to seller.
				getBuyerNickname();
				
			}
		}
		
		function checkThatTransactionDoesNotAlreadyExist()
		{
			dal.get_transactions_by_ForSaleId(connection, get_transactions_by_ForSaleId_callback, providedForSaleId);
		}
		
		function get_forSaleEntries_by_iD_callback(err, rows, fields)
		{
			if (err)
			{
				console.log(err);
				response.status(500).send({success: false, msg: 'Internal error.'});
			}
			else if(rows.length === 0)
			{ 
				response.status(400).send({success: false, msg: 'No For Sale Entries with this iD exist.'});
			}
			else
			{
				sellerId = rows[0].seller_InternalUserId;
				bookIsbn = rows[0].ISBN;
				
				if(sellerId === buyerId)
				{
					response.status(400).send({success: false, msg: 'Buyer is the same as seller.'});
				}
				else
				{
					//Now that we have know there is an existing For Sale Entry, next step is to make sure that there are no transactions tied to it.
					checkThatTransactionDoesNotAlreadyExist();
				}
			}
		}
		
		dal.get_forSaleEntries_by_iD(connection, get_forSaleEntries_by_iD_callback, providedForSaleId);
	}
	
	authenticate.checkToken(request, response, afterCheckTokenCallback);
}

methods.getTransactionsByUser = function(request, response, connection)
{
	function afterCheckTokenCallback(internalUserId)
	{
		//Insert code here to select all Transactions for this internalUserId where the transaction status is 0 (for Pending).
		//Join the Transaction table to the ForSale table to get information about the book being bought/sold, like the book title, author, price, etc.
		var transactionsArray = [];
		transactionsArray.push({iD: '3', buyerOrSeller: 'seller', buyer_Nickname: 'Daren C', buyer_InternalUserId: '2', transactionDateTime: '2017-02-22 00:02:40', satus: 'Pending', conversationId: 1,  title: 'Software Engineering for Dummies', author: 'Wallace Wang', ISBN: '9780470108543', price: '32.67'});
		transactionsArray.push({iD: '8', buyerOrSeller: 'buyer', seller_Nickname: 'Jonathan R', seller_InternalUserId: '5', transactionDateTime: '2017-02-24 00:07:41', satus: 'Pending', conversationId: 2,  title: 'Intermediate Algebra', author: 'Alan S. Tussy', ISBN: '9781111567675', price: '88.00'});
		response.send(transactionsArray);
	}
	
	authenticate.checkToken(request, response, afterCheckTokenCallback);
}

methods.getTransactionById = function(request, response, connection)
{
	function afterCheckTokenCallback(internalUserId)
	{
		var providedTransactionId = request.params.transactionId;
		console.log(providedTransactionId);
		
		//Insert code here to select from the Transaction table where the transaction ID is providedTransactionId.
		//...
		
		response.send({iD: '3', buyerOrSeller: 'seller', buyer_Nickname: 'Daren C', buyer_InternalUserId: '2', transactionDateTime: '2017-02-22 00:02:40', satus: 'Pending', conversationId: 1, title: 'Software Engineering for Dummies', author: 'Wallace Wang', ISBN: '9780470108543', price: '32.67'});
	}
	
	authenticate.checkToken(request, response, afterCheckTokenCallback);
}

methods.getPossibleTransactionStatuses = function(request, response, connection)
{
	function get_possibleTransactionStatuses_callback(err, rows, fields)
	{
		if (!err)
		{
			response.json(rows);
		}
		else
		{
			console.log(err);
			response.status(500).send({success: false, msg: 'Internal error.'});
		}
	}
	
	dal.get_possibleTransactionStatuses(connection, get_possibleTransactionStatuses_callback);
}

methods.markTransactionComplete = function(request, response, connection)
{
	function afterCheckTokenCallback(internalUserId)
	{
		var providedTransactionId = request.params.transactionId;
		console.log(providedTransactionId);
		
		//Insert code here to mark the specified Transaction record as complete......
		console.log('Insert code here to mark the specified Transaction record as complete......');
		response.send({success: true, msg: 'Transaction has been marked complete.'});
	}
	
	authenticate.checkToken(request, response, afterCheckTokenCallback);
}

methods.markTransactionCancelled = function(request, response, connection)
{
	function afterCheckTokenCallback(internalUserId)
	{
		var providedTransactionId = request.params.transactionId;
		console.log(providedTransactionId);
		
		//Insert code here to mark the specified Transaction record as cancelled......
		console.log('Insert code here to mark the specified Transaction record as cancelled......');
		response.send({success: true, msg: 'Transaction has been cancelled.'});
	}
	
	authenticate.checkToken(request, response, afterCheckTokenCallback);
}

module.exports = methods;