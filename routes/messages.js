var express = require("express");
var router = express.Router();
let messageModel = require('../schemas/messages');
let { CheckLogin } = require('../utils/authHandler');
let { uploadFile } = require('../utils/uploadHandler');

// 1. GET /:userID - Get all messages between current user and userID
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserID = req.user._id;
        let otherUserID = req.params.userID;

        let messages = await messageModel.find({
            $or: [
                { from: currentUserID, to: otherUserID },
                { from: otherUserID, to: currentUserID }
            ]
        }).sort({ createdAt: 1 });

        res.send(messages);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// 2. POST / - Post a content
router.post('/', CheckLogin, uploadFile.single('file'), async function (req, res, next) {
    try {
        let from = req.user._id;
        let { to, text } = req.body;
        let type = 'text';

        if (req.file) {
            type = 'file';
            text = req.file.path;
        }

        let newMessage = new messageModel({
            from,
            to,
            messageContent: {
                type,
                text
            }
        });

        await newMessage.save();
        res.send(newMessage);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

// 3. GET / - Get the last message of each conversation
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserID = req.user._id;

        let lastMessages = await messageModel.aggregate([
            {
                $match: {
                    $or: [
                        { from: currentUserID },
                        { to: currentUserID }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$from", currentUserID] },
                            "$to",
                            "$from"
                        ]
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    _id: 0,
                    otherUser: {
                        _id: '$user._id',
                        username: '$user.username'
                    },
                    lastMessage: 1
                }
            }
        ]);

        res.send(lastMessages);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
