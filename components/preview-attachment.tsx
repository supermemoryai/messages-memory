import type { Attachment } from '@ai-sdk/ui-utils';
import { CrossIcon, FileIcon, LoaderIcon } from './icons';
import { Button } from './ui/button';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onDelete,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onDelete?: (attachment: Attachment) => void;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div data-testid="input-attachment-preview" className="flex flex-col gap-2">
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center group">
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
            />
          ) : contentType === 'text/plain' ? (
            <div className="flex flex-col items-center justify-center gap-1">
              <FileIcon size={20} />
              {!isUploading && url && (
                <div className="text-[8px] text-muted-foreground line-clamp-2 px-1 text-center">
                  Text file
                </div>
              )}
            </div>
          ) : (
            <div className="" />
          )
        ) : (
          <div className="" />
        )}

        {isUploading && (
          <div
            data-testid="input-attachment-loader"
            className="animate-spin absolute text-zinc-500"
          >
            <LoaderIcon />
          </div>
        )}

        {onDelete ? (
          <Button
            data-testid="delete-attachment-button"
            className="absolute top-0 right-0 size-5 rounded-full p-0 bg-muted hover:bg-destructive hover:text-destructive-foreground invisible group-hover:visible transition-all duration-500 flex items-center justify-center"
            onClick={() => onDelete(attachment)}
            variant="outline"
          >
            <CrossIcon />
          </Button>
        ) : null}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};
