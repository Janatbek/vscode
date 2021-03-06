/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {isFalsyOrEmpty} from 'vs/base/common/arrays';
import {assign} from 'vs/base/common/objects';
import URI from 'vs/base/common/uri';
import {TPromise} from 'vs/base/common/winjs.base';
import {IPosition} from 'vs/editor/common/editorCommon';
import {ISuggestResult, ISuggestSupport, ISuggestion, ISuggestionFilter} from 'vs/editor/common/modes';
import {DefaultFilter, IMatch} from 'vs/editor/common/modes/modesFilters';
import {ISuggestResult2} from '../common/suggest';

export class CompletionItem {

	suggestion: ISuggestion;
	highlights: IMatch[];
	container: ISuggestResult;

	private _filter: ISuggestionFilter;
	private _support: ISuggestSupport;

	constructor(suggestion: ISuggestion, container: ISuggestResult2) {
		this._support = container.support;
		this.suggestion = suggestion;
		this.container = container;
		this._filter = container.support && container.support.getFilter() || DefaultFilter;
	}

	resolveDetails(resource: URI, position: IPosition): TPromise<ISuggestion> {
		if (!this._support || typeof this._support.getSuggestionDetails !== 'function') {
			return TPromise.as(this.suggestion);
		}

		return this._support.getSuggestionDetails(resource, position, this.suggestion);
	}

	updateDetails(value: ISuggestion): void {
		this.suggestion = assign(this.suggestion, value);
	}

	updateHighlights(word: string): boolean {
		this.highlights = this._filter(word, this.suggestion);
		return !isFalsyOrEmpty(this.highlights);
	}

	static compare(item: CompletionItem, otherItem: CompletionItem): number {
		const suggestion = item.suggestion;
		const otherSuggestion = otherItem.suggestion;

		if (typeof suggestion.sortText === 'string' && typeof otherSuggestion.sortText === 'string') {
			const one = suggestion.sortText.toLowerCase();
			const other = otherSuggestion.sortText.toLowerCase();

			if (one < other) {
				return -1;
			} else if (one > other) {
				return 1;
			}
		}

		return suggestion.label.toLowerCase() < otherSuggestion.label.toLowerCase() ? -1 : 1;
	}
}

export class CompletionModel {

	private _currentWord: string;
	private _items: CompletionItem[] = [];
	private _filteredItems: CompletionItem[] = undefined;

	constructor(public raw: ISuggestResult2[], currentWord: string) {
		this._currentWord = currentWord;
		for (let container of raw) {
			for (let suggestion of container.suggestions) {
				this._items.push(new CompletionItem(suggestion, container));
			}
		}
		this._items.sort(CompletionItem.compare);
	}

	get currentWord(): string {
		return this._currentWord;
	}

	set currentWord(value: string) {
		if (this._currentWord !== value) {
			this._filteredItems = undefined;
			this._currentWord = value;
		}
	}

	get items(): CompletionItem[] {
		if (!this._filteredItems) {
			this._filteredItems = [];
			for (let item of this._items) {
				if (item.updateHighlights(this.currentWord)) {
					this._filteredItems.push(item);
				}
			}
		}
		return this._filteredItems;
	}

}