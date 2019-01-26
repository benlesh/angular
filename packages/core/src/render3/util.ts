/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {assertDataInRange, assertDefined, assertGreaterThan, assertLessThan} from '../util/assert';
import {global} from '../util/global';

import {assertLView} from './assert';
import {LCONTAINER_LENGTH, LContainer} from './interfaces/container';
import {LContext, MONKEY_PATCH_KEY_NAME} from './interfaces/context';
import {ComponentDef, DirectiveDef} from './interfaces/definition';
import {NO_PARENT_INJECTOR, RelativeInjectorLocation, RelativeInjectorLocationFlags} from './interfaces/injector';
import {TContainerNode, TElementNode, TNode, TNodeFlags, TNodeType} from './interfaces/node';
import {RComment, RElement, RNode, RText} from './interfaces/renderer';
import {StylingContext} from './interfaces/styling';
import {CONTEXT, DECLARATION_VIEW, FLAGS, HEADER_OFFSET, HOST, LView, LViewFlags, PARENT, RootContext, TData, TVIEW, T_HOST} from './interfaces/view';



/**
 * Gets the parent LView of the passed LView, if the PARENT is an LContainer, will get the parent of
 * that LContainer, which is an LView
 * @param lView the lView whose parent to get
 */
export function getLViewParent(lView: LView): LView|null {
  ngDevMode && assertLView(lView);
  const parent = lView[PARENT];
  return isLContainer(parent) ? parent[PARENT] ! : parent;
}

/**
 * Returns true if the value is an {@link LView}
 * @param value the value to check
 */
export function isLView(value: any): value is LView {
  return Array.isArray(value) && value.length >= HEADER_OFFSET;
}


/**
 * Returns whether the values are different from a change detection stand point.
 *
 * Constraints are relaxed in checkNoChanges mode. See `devModeEqual` for details.
 */
export function isDifferent(a: any, b: any): boolean {
  // NaN is the only value that is not equal to itself so the first
  // test checks if both a and b are not NaN
  return !(a !== a && b !== b) && a !== b;
}

/**
 * Used for stringify render output in Ivy.
 */
export function renderStringify(value: any): string {
  if (typeof value == 'function') return value.name || value;
  if (typeof value == 'string') return value;
  if (value == null) return '';
  if (typeof value == 'object' && typeof value.type == 'function')
    return value.type.name || value.type;
  return '' + value;
}

/**
 * Flattens an array in non-recursive way. Input arrays are not modified.
 */
export function flatten(list: any[]): any[] {
  const result: any[] = [];
  let i = 0;

  while (i < list.length) {
    const item = list[i];
    if (Array.isArray(item)) {
      if (item.length > 0) {
        list = item.concat(list.slice(i + 1));
        i = 0;
      } else {
        i++;
      }
    } else {
      result.push(item);
      i++;
    }
  }

  return result;
}

/** Retrieves a value from any `LView` or `TData`. */
export function loadInternal<T>(view: LView | TData, index: number): T {
  ngDevMode && assertDataInRange(view, index + HEADER_OFFSET);
  return view[index + HEADER_OFFSET];
}

/**
 * Takes the value of a slot in `LView` and returns the element node.
 *
 * Normally, element nodes are stored flat, but if the node has styles/classes on it,
 * it might be wrapped in a styling context. Or if that node has a directive that injects
 * ViewContainerRef, it may be wrapped in an LContainer. Or if that node is a component,
 * it will be wrapped in LView. It could even have all three, so we keep looping
 * until we find something that isn't an array.
 *
 * @param value The initial value in `LView`
 */
export function readElementValue(value: any): RElement {
  while (Array.isArray(value)) {
    value = value[HOST] as any;
  }
  return value;
}

/**
 * TODO
 * @param lView
 */
export function getLastRootElementFromView(lView: LView): RNode {
  const tView = lView[TVIEW];
  let child = tView.firstChild;
  ngDevMode && assertDefined(child, 'tView must have at least one root element');
  let lastChild: TNode;
  while (child) {
    lastChild = child;
    child = child.next;
  }
  return lView[lastChild !.index];
}

/**
 * TODO: comment
 * @param value
 */
export function getLContainer(value: LContainer | RNode | StylingContext): LContainer|null {
  while (Array.isArray(value)) {
    value = value[HOST] as any;
    if (isLContainer(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Retrieves an element value from the provided `viewData`, by unwrapping
 * from any containers, component views, or style contexts.
 */
export function getNativeByIndex(index: number, lView: LView): RElement {
  return readElementValue(lView[index + HEADER_OFFSET]);
}

export function getNativeByTNode(tNode: TNode, hostView: LView): RElement|RText|RComment {
  return readElementValue(hostView[tNode.index]);
}

export function getTNode(index: number, view: LView): TNode {
  ngDevMode && assertGreaterThan(index, -1, 'wrong index for TNode');
  ngDevMode && assertLessThan(index, view[TVIEW].data.length, 'wrong index for TNode');
  return view[TVIEW].data[index + HEADER_OFFSET] as TNode;
}

export function getComponentViewByIndex(nodeIndex: number, hostView: LView): LView {
  // Could be an LView or an LContainer. If LContainer, unwrap to find LView.
  const slotValue = hostView[nodeIndex];
  const lView = isLView(slotValue) ? slotValue : slotValue[HOST];
  ngDevMode && assertLView(lView);
  return lView;
}

export function isContentQueryHost(tNode: TNode): boolean {
  return (tNode.flags & TNodeFlags.hasContentQuery) !== 0;
}

export function isComponent(tNode: TNode): boolean {
  return (tNode.flags & TNodeFlags.isComponent) === TNodeFlags.isComponent;
}

export function isComponentDef<T>(def: DirectiveDef<T>): def is ComponentDef<T> {
  return (def as ComponentDef<T>).template !== null;
}

export function isLContainer(value: any): value is LContainer {
  // Styling contexts are also arrays, but their first index contains an element node
  return Array.isArray(value) && value.length === LCONTAINER_LENGTH;
}

export function isRootView(target: LView): boolean {
  return (target[FLAGS] & LViewFlags.IsRoot) !== 0;
}

/**
 * Retrieve the root view from any component or `LView` by walking the parent `LView` until
 * reaching the root `LView`.
 *
 * @param componentOrLView any component or `LView`
 */
export function getRootView(componentOrLView: LView | {}): LView {
  ngDevMode && assertDefined(componentOrLView, 'component');
  let lView = isLView(componentOrLView) ? componentOrLView : readPatchedLView(componentOrLView) !;
  while (lView && !(lView[FLAGS] & LViewFlags.IsRoot)) {
    lView = getLViewParent(lView) !;
  }
  ngDevMode && assertLView(lView);
  return lView;
}
/**
 * Returns the `RootContext` instance that is associated with
 * the application where the target is situated. It does this by walking the parent views until it
 * gets to the root view, then getting the context off of that.
 *
 * @param viewOrComponent the `LView` or component to get the root context for.
 */
export function getRootContext(viewOrComponent: LView | {}): RootContext {
  const rootView = getRootView(viewOrComponent);
  ngDevMode &&
      assertDefined(rootView[CONTEXT], 'RootView has no context. Perhaps it is disconnected?');
  return rootView[CONTEXT] as RootContext;
}

/**
 * Returns the monkey-patch value data present on the target (which could be
 * a component, directive or a DOM node).
 */
export function readPatchedData(target: any): LView|LContext|null {
  ngDevMode && assertDefined(target, 'Target expected');
  return target[MONKEY_PATCH_KEY_NAME];
}

export function readPatchedLView(target: any): LView|null {
  const value = readPatchedData(target);
  if (value) {
    return Array.isArray(value) ? value : (value as LContext).lView;
  }
  return null;
}

export function hasParentInjector(parentLocation: RelativeInjectorLocation): boolean {
  return parentLocation !== NO_PARENT_INJECTOR;
}

export function getParentInjectorIndex(parentLocation: RelativeInjectorLocation): number {
  return (parentLocation as any as number) & RelativeInjectorLocationFlags.InjectorIndexMask;
}

export function getParentInjectorViewOffset(parentLocation: RelativeInjectorLocation): number {
  return (parentLocation as any as number) >> RelativeInjectorLocationFlags.ViewOffsetShift;
}

/**
 * Unwraps a parent injector location number to find the view offset from the current injector,
 * then walks up the declaration view tree until the view is found that contains the parent
 * injector.
 *
 * @param location The location of the parent injector, which contains the view offset
 * @param startView The LView instance from which to start walking up the view tree
 * @returns The LView instance that contains the parent injector
 */
export function getParentInjectorView(location: RelativeInjectorLocation, startView: LView): LView {
  let viewOffset = getParentInjectorViewOffset(location);
  let parentView = startView;
  // For most cases, the parent injector can be found on the host node (e.g. for component
  // or container), but we must keep the loop here to support the rarer case of deeply nested
  // <ng-template> tags or inline views, where the parent injector might live many views
  // above the child injector.
  while (viewOffset > 0) {
    parentView = parentView[DECLARATION_VIEW] !;
    viewOffset--;
  }
  return parentView;
}

/**
 * Unwraps a parent injector location number to find the view offset from the current injector,
 * then walks up the declaration view tree until the TNode of the parent injector is found.
 *
 * @param location The location of the parent injector, which contains the view offset
 * @param startView The LView instance from which to start walking up the view tree
 * @param startTNode The TNode instance of the starting element
 * @returns The TNode of the parent injector
 */
export function getParentInjectorTNode(
    location: RelativeInjectorLocation, startView: LView, startTNode: TNode): TElementNode|
    TContainerNode|null {
  if (startTNode.parent && startTNode.parent.injectorIndex !== -1) {
    // view offset is 0
    const injectorIndex = startTNode.parent.injectorIndex;
    let parentTNode = startTNode.parent;
    while (parentTNode.parent != null && injectorIndex == parentTNode.injectorIndex) {
      parentTNode = parentTNode.parent;
    }
    return parentTNode;
  }

  let viewOffset = getParentInjectorViewOffset(location);
  // view offset is 1
  let parentView = startView;
  let parentTNode = startView[T_HOST] as TElementNode;

  // view offset is superior to 1
  while (viewOffset > 1) {
    parentView = parentView[DECLARATION_VIEW] !;
    parentTNode = parentView[T_HOST] as TElementNode;
    viewOffset--;
  }
  return parentTNode;
}

export const defaultScheduler =
    (typeof requestAnimationFrame !== 'undefined' && requestAnimationFrame ||  // browser only
     setTimeout                                                                // everything else
     ).bind(global);

/**
 * Equivalent to ES6 spread, add each item to an array.
 *
 * @param items The items to add
 * @param arr The array to which you want to add the items
 */
export function addAllToArray(items: any[], arr: any[]) {
  for (let i = 0; i < items.length; i++) {
    arr.push(items[i]);
  }
}

/**
 * Given a current view, finds the nearest component's host (LElement).
 *
 * @param lView LView for which we want a host element node
 * @returns The host node
 */
export function findComponentView(lView: LView): LView {
  let rootTNode = lView[T_HOST];

  while (rootTNode && rootTNode.type === TNodeType.View) {
    ngDevMode && assertDefined(lView[DECLARATION_VIEW], 'lView[DECLARATION_VIEW]');
    lView = lView[DECLARATION_VIEW] !;
    rootTNode = lView[T_HOST];
  }

  ngDevMode && assertLView(lView);
  return lView;
}

export function resolveWindow(element: RElement & {ownerDocument: Document}) {
  return {name: 'window', target: element.ownerDocument.defaultView};
}

export function resolveDocument(element: RElement & {ownerDocument: Document}) {
  return {name: 'document', target: element.ownerDocument};
}

export function resolveBody(element: RElement & {ownerDocument: Document}) {
  return {name: 'body', target: element.ownerDocument.body};
}

/**
 * The special delimiter we use to separate property names, prefixes, and suffixes
 * in property binding metadata. See storeBindingMetadata().
 *
 * We intentionally use the Unicode "REPLACEMENT CHARACTER" (U+FFFD) as a delimiter
 * because it is a very uncommon character that is unlikely to be part of a user's
 * property names or interpolation strings. If it is in fact used in a property
 * binding, DebugElement.properties will not return the correct value for that
 * binding. However, there should be no runtime effect for real applications.
 *
 * This character is typically rendered as a question mark inside of a diamond.
 * See https://en.wikipedia.org/wiki/Specials_(Unicode_block)
 *
 */
export const INTERPOLATION_DELIMITER = `�`;

/**
 * Determines whether or not the given string is a property metadata string.
 * See storeBindingMetadata().
 */
export function isPropMetadataString(str: string): boolean {
  return str.indexOf(INTERPOLATION_DELIMITER) >= 0;
}
