/**
 * Copyright (c) 2011-2016 by Andrew Mustun. All rights reserved.
 * 
 * This file is part of the QCAD project.
 *
 * QCAD is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * QCAD is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with QCAD.
 */

include("scripts/EAction.js");
include("scripts/ShapeAlgorithms.js");
include("scripts/Draw/Line/Line.js");

/**
 * \class Offset
 * \brief Parallel lines, concentric arcs, circles, equidistant curve to ellipses.
 * \ingroup ecma_modify
 */
function Offset(guiAction) {
    EAction.call(this, guiAction);

    this.segmentMode = true;
    this.distance = undefined;
    this.number = undefined;
    this.entity = undefined;
    this.entityId = undefined;
    this.shape = undefined;
    this.pos = undefined;
    this.lineType = undefined;

    if (!isNull(guiAction)) {
        this.setUiOptions(Offset.includeBasePath + "/Offset.ui");
    }
}

Offset.prototype = new EAction();
Offset.includeBasePath = includeBasePath;

Offset.State = {
    ChoosingEntity : 0
};

Offset.prototype.beginEvent = function() {
    EAction.prototype.beginEvent.call(this);

    this.setState(Offset.State.ChoosingEntity);
};

Offset.prototype.initState = function() {
    EAction.prototype.initState.call(this);

    this.getDocumentInterface().setClickMode(RAction.PickEntity);
    this.setCrosshairCursor();

    switch (this.state) {
    case Offset.State.ChoosingEntity:
        this.setLeftMouseTip(this.getLeftMouseTip());
        break;
    }

    this.setRightMouseTip(EAction.trCancel);
};

Offset.prototype.getLeftMouseTip = function() {
    return qsTr("Choose line, arc, circle or ellipse");
};

Offset.prototype.isShapeSupported = function(shape) {
    return isLineBasedShape(shape) ||
           isArcShape(shape) ||
           isCircleShape(shape) ||
           isEllipseShape(shape);
};

Offset.prototype.warnUnsupportedShape = function() {
    EAction.warnNotLineArcCircleEllipse();
};

Offset.prototype.escapeEvent = function() {
    switch (this.state) {
    case Offset.State.ChoosingEntity:
        EAction.prototype.escapeEvent.call(this);
        break;
    }
};

Offset.prototype.pickEntity = function(event, preview) {
    var di = this.getDocumentInterface();
    var doc = this.getDocument();
    var entityId = this.getEntityId(event, preview);
    var entity = doc.queryEntity(entityId);
    var pos = event.getModelPosition();

    if (isNull(entity)) {
        this.entity = undefined;
        this.entityId = RObject.INVALID_ID;
        return;
    }

    switch (this.state) {
    case Offset.State.ChoosingEntity:
        var shape;
        if (this.segmentMode) {
            //  parallel to polyline segment:
            shape = entity.getClosestSimpleShape(pos);
        }
        else {
            shape = entity.getClosestShape(pos);
        }

        if (this.isShapeSupported(shape)) {
            this.entity = entity;
            this.entityId = entityId;
            this.shape = shape;
            this.pos = pos;
        }
        else {
            if (!preview) {
                this.warnUnsupportedShape();
                break;
            }
        }

        if (preview) {
            this.updatePreview();
        }
        else {
            var op = this.getOperation(false);
            if (!isNull(op)) {
                di.applyOperation(op);
                if (!isNull(this.error)) {
                    EAction.handleUserWarning(this.error);
                }
            }
        }
        break;
    }
};

Offset.prototype.getOperation = function(preview) {
    if (isNull(this.pos) || isNull(this.entity) ||
        !isNumber(this.distance) || !isNumber(this.number) ||
        !isShape(this.shape)) {

        return undefined;
    }

    var offsetShapes = this.getOffsetShapes(preview);
    if (!preview) {
        this.error = ShapeAlgorithms.error;
    }

    if (isNull(offsetShapes)) {
        return undefined;
    }

    var doc = this.getDocument();
    var e;
    var op = new RAddObjectsOperation();
    op.setText(this.getToolTitle());
    for (var i=0; i<offsetShapes.length; ++i) {
        if (isLineBasedShape(offsetShapes[i]) && !isNull(this.lineType)) {
            e = Line.createLineEntity(doc, offsetShapes[i].getStartPoint(), offsetShapes[i].getEndPoint(), this.lineType);
        }
        else {
            if (isFunction(offsetShapes[i].data)) {
                e = shapeToEntity(doc, offsetShapes[i].data());
            }
            else {
                e = shapeToEntity(doc, offsetShapes[i]);
            }
        }

        if (!isNull(e)) {
            this.addObjectToOperation(op, e);
        }
    }
    return op;
};

Offset.prototype.addObjectToOperation = function(operation, entity) {
    operation.addObject(entity);
};

Offset.prototype.getOffsetShapes = function(preview) {
    return ShapeAlgorithms.getOffsetShapes(this.shape, this.distance, this.number, this.pos);
};

Offset.prototype.getHighlightedEntities = function() {
    var ret = [];
    if (isEntity(this.entity)) {
        ret.push(this.entity.getId());
    }
    return ret;
};

Offset.prototype.slotDistanceChanged = function(value) {
    this.distance = value;
    this.updatePreview(true);
};

Offset.prototype.slotNumberChanged  = function(value) {
    this.number = value;
    this.updatePreview(true);
};

